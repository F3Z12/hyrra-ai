"""
OpenClaw subprocess runner service.  Dev/local only.

Prerequisites (must all be true before calling run_openclaw_fill):
  1. ENABLE_LOCAL_OPENCLAW_RUNNER=true in .env
  2. OpenClaw gateway running  (openclaw gateway start)
  3. OpenClaw managed browser started  (openclaw browser start)
  4. Private-network access enabled:
       openclaw config set browser.ssrfPolicy.dangerouslyAllowPrivateNetwork true --strict-json
  5. `openclaw` binary on PATH or OPENCLAW_BIN set in .env

Windows note:
  Python's subprocess calls .cmd files via cmd.exe even with shell=False.
  cmd.exe mangles double-quotes, percent signs, and carets inside arguments.
  To avoid this we check for a --message-file flag (openclaw agent --help),
  and fall back to writing the prompt to a temp file when the prompt exceeds
  _PROMPT_FILE_THRESHOLD chars or when a file flag is detected.
  Set OPENCLAW_BIN to the extensionless shim or a .ps1 path if available.

Security constraints enforced here:
  - shell=False (no shell injection surface)
  - Prompt generated entirely from validated DB data — no client strings in argv
  - Timeout clamped by the endpoint before reaching this service
  - _PROC_BUFFER added beyond --timeout so OpenClaw can serialise its JSON
"""

import json
import os
import shutil
import subprocess
import sys
import tempfile
import time
from dataclasses import dataclass, field

from app.core.config import OPENCLAW_BIN, OPENCLAW_CODEX_APP_SERVER_BIN
from app.services.apply_agent_fill_plan_service import ApplyAgentFillPlanResponse
from app.services.openclaw_task_service import generate_openclaw_prompt

_PROC_BUFFER: int = 10    # extra seconds beyond --timeout for JSON serialisation

# Prompts longer than this threshold trigger a temp-file strategy to avoid
# the cmd.exe 8 191-char command-line limit (and argument mangling).
_PROMPT_FILE_THRESHOLD: int = 4000


# ---------------------------------------------------------------------------
# Result dataclass
# ---------------------------------------------------------------------------

@dataclass
class OpenClawRunResult:
    status:        str           # "ok" | "error" | "timeout"
    duration_ms:   int
    command:       str           # safe display — prompt replaced with placeholder
    openclaw_json: dict | None   # parsed JSON from stdout, or None
    final_text:    str | None    # convenience extraction from openclaw_json
    stdout:        str
    stderr:        str
    error:         str | None    # None when status == "ok"
    # Debug / diagnostic fields
    prompt_length:          int       = 0
    prompt_preview:         str       = ""   # first 300 chars, no PII risk in most cases
    resolved_command:       str       = ""
    argv_without_prompt:    list[str] = field(default_factory=list)
    timeout_used:           int       = 0
    codex_bin_configured:   bool      = False  # True if OPENCLAW_CODEX_APP_SERVER_BIN was injected


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _make_startupinfo():
    """Return a STARTUPINFO that hides the console window on Windows."""
    if sys.platform != "win32":
        return None
    si = subprocess.STARTUPINFO()
    si.dwFlags |= subprocess.STARTF_USESHOWWINDOW
    si.wShowWindow = subprocess.SW_HIDE
    return si


def _build_subprocess_env() -> tuple[dict, bool]:
    """
    Return (env, codex_configured) where env is a copy of os.environ with any
    missing OpenClaw-specific variables injected from config.

    Why: on Windows the Python backend process may be launched from an IDE or
    PowerShell session that did not source the npm global environment, so child
    processes won't see variables like OPENCLAW_CODEX_APP_SERVER_BIN even if
    they are defined in .env.  We inject them explicitly so every subprocess.run
    call in this module gets a consistent environment regardless of how the
    backend was started.
    """
    env = os.environ.copy()
    codex_configured = False
    if OPENCLAW_CODEX_APP_SERVER_BIN:
        env["OPENCLAW_CODEX_APP_SERVER_BIN"] = OPENCLAW_CODEX_APP_SERVER_BIN
        codex_configured = True
    return env, codex_configured


def resolve_openclaw_command() -> str | None:
    """
    Return the path to the OpenClaw executable, or None if not found.

    Resolution order:
    1. OPENCLAW_BIN env var (set in .env) — must point to an existing file.
    2. shutil.which("openclaw")      — Unix/Mac installs; also finds .cmd via PATHEXT.
    3. shutil.which("openclaw.cmd")  — Windows npm .cmd shim explicitly.
    4. %APPDATA%\\npm\\openclaw.cmd  — npm global dir, not on PATH.
    5. %APPDATA%\\npm\\openclaw      — bare shim fallback.

    Tip: on Windows prefer setting OPENCLAW_BIN to openclaw.cmd (or openclaw.ps1
    called via powershell.exe) rather than relying on PATH discovery.
    """
    if OPENCLAW_BIN and os.path.isfile(OPENCLAW_BIN):
        return OPENCLAW_BIN

    for name in ("openclaw", "openclaw.cmd"):
        found = shutil.which(name)
        if found:
            return found

    appdata = os.environ.get("APPDATA", "")
    if appdata:
        for name in ("openclaw.cmd", "openclaw"):
            candidate = os.path.join(appdata, "npm", name)
            if os.path.isfile(candidate):
                return candidate

    return None


def _check_openclaw_file_flag(oc_bin: str) -> str | None:
    """
    Run 'openclaw agent --help' and return the first recognised file-input flag,
    or None if the help text reveals no such flag.

    Times out after 10 s to avoid blocking the main request.
    """
    try:
        env, _ = _build_subprocess_env()
        result = subprocess.run(
            [oc_bin, "agent", "--help"],
            shell=False,
            capture_output=True,
            text=True,
            timeout=10,
            startupinfo=_make_startupinfo(),
            env=env,
        )
        help_text = (result.stdout + result.stderr).lower()
        for flag in ("--message-file", "--prompt-file", "--input-file", "--file", "--input"):
            if flag in help_text:
                return flag
    except Exception:
        pass
    return None


def _parse_stdout_json(stdout: str) -> dict | None:
    """Try to extract a JSON object from stdout. Returns None on any failure."""
    text = stdout.strip()
    if not text:
        return None
    for candidate in (text, text[text.find("{"):] if "{" in text else ""):
        try:
            parsed = json.loads(candidate)
            if isinstance(parsed, dict):
                return parsed
        except (json.JSONDecodeError, ValueError):
            continue
    return None


def _extract_final_text(parsed: dict | None) -> str | None:
    if not parsed:
        return None
    for key in ("result", "message", "text", "content", "output"):
        if key in parsed and isinstance(parsed[key], str):
            return parsed[key]
    return None


def _make_error(
    msg: str,
    *,
    oc_bin: str = "",
    prompt_length: int = 0,
    prompt_preview: str = "",
    argv: list[str] | None = None,
    timeout: int = 0,
    duration_ms: int = 0,
    stdout: str = "",
    stderr: str = "",
    parsed: dict | None = None,
) -> OpenClawRunResult:
    return OpenClawRunResult(
        status="error",
        duration_ms=duration_ms,
        command="<not run>",
        openclaw_json=parsed,
        final_text=None,
        stdout=stdout,
        stderr=stderr,
        error=msg,
        prompt_length=prompt_length,
        prompt_preview=prompt_preview,
        resolved_command=oc_bin,
        argv_without_prompt=argv or [],
        timeout_used=timeout,
    )


# ---------------------------------------------------------------------------
# Smoke test (internal — hardcoded message, NOT exposed to frontend)
# ---------------------------------------------------------------------------

def run_openclaw_smoke_test(timeout_seconds: int = 120) -> OpenClawRunResult:
    """
    Verify that subprocess argument passing works end-to-end.

    The message is hardcoded here — no external input is accepted.
    This function is NOT reachable from any API endpoint; call it from
    a management command or test script only.
    """
    smoke_message = "Say exactly: backend subprocess message works."

    oc_bin = resolve_openclaw_command()
    if oc_bin is None:
        return _make_error(
            "OpenClaw binary not found for smoke test. "
            "Checked: OPENCLAW_BIN, PATH openclaw/openclaw.cmd, APPDATA npm fallback.",
        )

    cmd = [
        oc_bin, "agent",
        "--agent",   "main",
        "--message", smoke_message,
        "--json",
        "--timeout", str(timeout_seconds),
    ]
    argv_no_prompt = [oc_bin, "agent", "--agent", "main", "--json", "--timeout", str(timeout_seconds)]
    display = f"{oc_bin} agent --agent main --message <smoke_message> --json --timeout {timeout_seconds}"
    env, codex_configured = _build_subprocess_env()
    start = time.monotonic()

    try:
        proc = subprocess.run(
            cmd, shell=False, capture_output=True, text=True,
            timeout=timeout_seconds + _PROC_BUFFER,
            startupinfo=_make_startupinfo(),
            env=env,
        )
        duration_ms = int((time.monotonic() - start) * 1000)
        parsed = _parse_stdout_json(proc.stdout or "")
        ok = proc.returncode == 0
        return OpenClawRunResult(
            status="ok" if ok else "error",
            duration_ms=duration_ms,
            command=display,
            openclaw_json=parsed,
            final_text=_extract_final_text(parsed),
            stdout=proc.stdout or "",
            stderr=proc.stderr or "",
            error=None if ok else f"Exit {proc.returncode}: {(proc.stderr or '')[:200]}",
            prompt_length=len(smoke_message),
            prompt_preview=smoke_message,
            resolved_command=oc_bin,
            argv_without_prompt=argv_no_prompt,
            timeout_used=timeout_seconds,
            codex_bin_configured=codex_configured,
        )
    except subprocess.TimeoutExpired as exc:
        return OpenClawRunResult(
            status="timeout",
            duration_ms=int((time.monotonic() - start) * 1000),
            command=display,
            openclaw_json=None,
            final_text=None,
            stdout=exc.stdout if isinstance(exc.stdout, str) else "",
            stderr=exc.stderr if isinstance(exc.stderr, str) else "",
            error=f"Smoke test timed out after {timeout_seconds}s",
            resolved_command=oc_bin,
            argv_without_prompt=argv_no_prompt,
            timeout_used=timeout_seconds,
        )
    except Exception as exc:  # noqa: BLE001
        return OpenClawRunResult(
            status="error",
            duration_ms=int((time.monotonic() - start) * 1000),
            command=display,
            openclaw_json=None,
            final_text=None,
            stdout="",
            stderr="",
            error=f"Smoke test: {type(exc).__name__}: {exc}",
            resolved_command=oc_bin,
            argv_without_prompt=argv_no_prompt,
            timeout_used=timeout_seconds,
        )


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def run_openclaw_fill(
    fill_plan: ApplyAgentFillPlanResponse,
    timeout_seconds: int,
) -> OpenClawRunResult:
    """
    Invoke OpenClaw with the task prompt derived from fill_plan.

    timeout_seconds must already be clamped by the caller (endpoint).

    Prompt delivery strategy (Windows cmd.exe safe):
    1. If prompt > _PROMPT_FILE_THRESHOLD chars, check --help for a file flag.
    2. If a file flag exists, write prompt to a temp file and pass the path.
    3. Otherwise pass via --message (works fine when prompt is short/clean).
    """
    prompt = generate_openclaw_prompt(fill_plan)

    # --- Validate prompt before spawning anything ---
    if not prompt or not prompt.strip():
        return _make_error("Generated OpenClaw prompt is empty.")

    prompt_length  = len(prompt)
    prompt_preview = prompt[:300]

    # --- Resolve binary ---
    oc_bin = resolve_openclaw_command()
    if oc_bin is None:
        return _make_error(
            "OpenClaw binary not found. "
            "Checked: OPENCLAW_BIN env var, PATH 'openclaw', PATH 'openclaw.cmd', "
            "%APPDATA%\\npm\\openclaw.cmd, %APPDATA%\\npm\\openclaw. "
            "Set OPENCLAW_BIN=<full path> in backend/.env and restart.",
            prompt_length=prompt_length,
            prompt_preview=prompt_preview,
        )

    argv_no_prompt = [oc_bin, "agent", "--agent", "main", "--json", "--timeout", str(timeout_seconds)]

    # --- Decide prompt delivery: --message vs temp file ---
    file_flag: str | None = None
    if prompt_length > _PROMPT_FILE_THRESHOLD:
        file_flag = _check_openclaw_file_flag(oc_bin)

    display_cmd = (
        f"{oc_bin} agent --agent main "
        f"{'--message <generated_prompt>' if file_flag is None else f'{file_flag} <tmp_file>'} "
        f"--json --timeout {timeout_seconds}"
    )

    env, codex_configured = _build_subprocess_env()
    start = time.monotonic()
    tmp_path: str | None = None

    try:
        # Inner try/finally: always clean up temp file even on exception
        try:
            if file_flag:
                tf = tempfile.NamedTemporaryFile(
                    mode="w", suffix=".txt", delete=False, encoding="utf-8"
                )
                try:
                    tf.write(prompt)
                finally:
                    tf.close()
                tmp_path = tf.name
                cmd = [oc_bin, "agent", "--agent", "main",
                       file_flag, tmp_path, "--json", "--timeout", str(timeout_seconds)]
            else:
                cmd = [oc_bin, "agent", "--agent", "main",
                       "--message", prompt, "--json", "--timeout", str(timeout_seconds)]

            proc = subprocess.run(
                cmd,
                shell=False,
                capture_output=True,
                text=True,
                timeout=timeout_seconds + _PROC_BUFFER,
                startupinfo=_make_startupinfo(),
                env=env,
            )
        finally:
            if tmp_path:
                try:
                    os.unlink(tmp_path)
                except OSError:
                    pass

        # Normal completion path
        duration_ms = int((time.monotonic() - start) * 1000)
        stdout  = proc.stdout or ""
        stderr  = proc.stderr or ""
        parsed  = _parse_stdout_json(stdout)
        final   = _extract_final_text(parsed)

        base = dict(
            duration_ms=duration_ms,
            command=display_cmd,
            openclaw_json=parsed,
            final_text=final,
            stdout=stdout,
            stderr=stderr,
            prompt_length=prompt_length,
            prompt_preview=prompt_preview,
            resolved_command=oc_bin,
            argv_without_prompt=argv_no_prompt,
            timeout_used=timeout_seconds,
            codex_bin_configured=codex_configured,
        )

        if proc.returncode == 0:
            return OpenClawRunResult(status="ok", error=None, **base)

        msg = f"OpenClaw exited with code {proc.returncode}"
        if stderr:
            msg += f": {stderr[:300]}"
        return OpenClawRunResult(status="error", error=msg, **base)

    except Exception as exc:  # noqa: BLE001  (TimeoutExpired, FileNotFoundError, etc.)
        return _handle_exc(
            exc, start, display_cmd, oc_bin, argv_no_prompt,
            timeout_seconds, prompt_length, prompt_preview,
        )


def _handle_exc(
    exc: Exception,
    start: float,
    display_cmd: str,
    oc_bin: str,
    argv_no_prompt: list[str],
    timeout_seconds: int,
    prompt_length: int,
    prompt_preview: str,
) -> OpenClawRunResult:
    duration_ms = int((time.monotonic() - start) * 1000)
    if isinstance(exc, subprocess.TimeoutExpired):
        return OpenClawRunResult(
            status="timeout",
            duration_ms=duration_ms,
            command=display_cmd,
            openclaw_json=None,
            final_text=None,
            stdout=exc.stdout if isinstance(exc.stdout, str) else "",
            stderr=exc.stderr if isinstance(exc.stderr, str) else "",
            error=f"OpenClaw timed out after {timeout_seconds}s",
            prompt_length=prompt_length,
            prompt_preview=prompt_preview,
            resolved_command=oc_bin,
            argv_without_prompt=argv_no_prompt,
            timeout_used=timeout_seconds,
        )
    if isinstance(exc, FileNotFoundError):
        return OpenClawRunResult(
            status="error",
            duration_ms=duration_ms,
            command=display_cmd,
            openclaw_json=None,
            final_text=None,
            stdout="",
            stderr="",
            error=f"Binary not executable at '{oc_bin}'. Set OPENCLAW_BIN in .env.",
            prompt_length=prompt_length,
            prompt_preview=prompt_preview,
            resolved_command=oc_bin,
            argv_without_prompt=argv_no_prompt,
            timeout_used=timeout_seconds,
        )
    return OpenClawRunResult(
        status="error",
        duration_ms=duration_ms,
        command=display_cmd,
        openclaw_json=None,
        final_text=None,
        stdout="",
        stderr="",
        error=f"{type(exc).__name__}: {exc}",
        prompt_length=prompt_length,
        prompt_preview=prompt_preview,
        resolved_command=oc_bin,
        argv_without_prompt=argv_no_prompt,
        timeout_used=timeout_seconds,
    )
