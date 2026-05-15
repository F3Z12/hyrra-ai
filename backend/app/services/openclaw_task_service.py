"""
OpenClaw task service.

Generates the natural-language task prompt that is passed to the OpenClaw agent.
The backend is the sole source of this prompt — it is never accepted from the client.

Security rules enforced here:
- Prompt is generated entirely server-side from validated DB data.
- No client-supplied strings are interpolated into the prompt without sanitisation.
- OpenClaw is instructed never to click submit or interact with blocked fields.
- The prompt only describes fields in the fill plan's 'fillable' list.
"""

from app.services.apply_agent_fill_plan_service import ApplyAgentFillPlanResponse

# Treat these two origins as equivalent when checking "already on target page":
# localhost and 127.0.0.1 both refer to the loopback interface on the same machine.
_LOCAL_EQUIVALENTS = {
    "localhost": "127.0.0.1",
    "127.0.0.1": "localhost",
}


def _url_alternatives(url: str) -> list[str]:
    """Return the URL and its loopback-equivalent variant (if applicable)."""
    if not url:
        return [url]
    variants = [url]
    for orig, alt in _LOCAL_EQUIVALENTS.items():
        if orig in url:
            variants.append(url.replace(orig, alt, 1))
            break
    return variants


def generate_openclaw_prompt(fill_plan: ApplyAgentFillPlanResponse) -> str:
    """
    Build a compact OpenClaw prompt from a validated fill plan.

    Design goals:
    - Stay under 4 000 chars so the prompt fits safely within the Windows
      cmd.exe 8 191-char command-line limit when passed via --message.
    - Minimise double-quote and percent characters — cmd.exe mangles them when
      the Python subprocess calls a .cmd wrapper.
    - Use single quotes in CSS selectors and inline JS instead of double quotes.
    - Keep every instruction on one line so the text is easy to scan.
    """
    session_id = fill_plan.session_id

    if not fill_plan.fillable:
        return (
            f"No fillable fields for session {session_id}. "
            "All were blocked. Do not interact with any element. "
            "Output: session_id, filled=[], failed=[], url."
        )

    parts: list[str] = []

    # 1. Context
    parts.append(
        f"TASK: Fill {fill_plan.fillable_count} form field(s) in the OpenClaw managed browser "
        f"for session {session_id}."
    )
    parts.append(
        "CONTEXT: Isolated browser — no Hyrra extension installed. "
        "Do not access localStorage, sessionStorage, or any extension API. "
        "All fill values are provided below."
    )

    # 2. Tool
    parts.append("TOOL: Use the browser tool for every action. Do not describe steps — execute them.")

    # 3. Navigation
    if fill_plan.target_url:
        variants = _url_alternatives(fill_plan.target_url)
        alt = variants[1] if len(variants) > 1 else ""
        nav = f"NAVIGATE: If not already on {fill_plan.target_url}"
        if alt:
            nav += f" or {alt}"
        nav += f", navigate there now. localhost and 127.0.0.1 are the same machine."
        parts.append(nav)
    else:
        parts.append("NAVIGATE: No URL provided. Use whatever page is currently open.")

    # 4. Verify
    parts.append(
        "VERIFY: Before filling, confirm an element with attribute "
        "data-hyrra-apply-demo=true exists in the DOM. "
        "If absent, stop and report field_key __page_verification__ as failed."
    )

    # 5. Safety
    parts.append(
        "SAFETY: "
        "(a) Only fill the listed fields. "
        "(b) Never click Submit, Apply, Next, or Continue. "
        "(c) Never touch select, checkbox, radio, or file-upload elements. "
        "(d) Skip and report any field you cannot locate with the given selector."
    )

    # 6. Fill method (React-compatible)
    parts.append(
        "FILL METHOD: For each input: click to focus, Ctrl+A to select all, "
        "then type the value via keyboard. "
        "Do NOT assign element.value directly — that bypasses React onChange."
    )

    # 7. Review indicator JS (single-quoted, no cmd.exe-hostile chars)
    # JSON.stringify produces the quoted key needed for the CSS attribute selector.
    review_js = (
        "(function(k){"
        "var s='[data-field-key='+JSON.stringify(k)+']';"
        "var w=document.querySelector(s);"
        "if(!w)return;"
        "w.classList.add('hyrra-review-required');"
        "if(!w.querySelector('.hyrra-review-warning')){"
        "var e=document.createElement('div');"
        "e.className='hyrra-review-warning';"
        "e.textContent='Auto-filled';"
        "w.appendChild(e);"
        "}"
        "})"
    )
    parts.append(
        f"AFTER EACH FILL: Execute this JS (replace KEY with the field_key string): "
        f"{review_js}('KEY') — failure is non-fatal, continue to next field."
    )

    # 8. Fields to fill — compact one-line-per-field format
    field_lines = [f"FIELDS TO FILL ({fill_plan.fillable_count}):"]
    for i, f in enumerate(fill_plan.fillable, 1):
        sel = f.selector if f.selector else f"[data-field-key='{f.field_key}'] input"
        # Use repr() for the value so it is always a safe Python string literal
        # (single-quoted, backslash-escaped) — avoids cmd.exe double-quote issues.
        field_lines.append(f"  {i}. key={f.field_key}  sel={sel}  val={repr(f.value)}")
    parts.append("\n".join(field_lines))

    # 9. Blocked fields — do not touch
    if fill_plan.blocked:
        skip_lines = [f"SKIP - DO NOT TOUCH ({fill_plan.blocked_count}):"]
        for bf in fill_plan.blocked:
            skip_lines.append(f"  - {bf.field_key}: {bf.reason}")
        parts.append("\n".join(skip_lines))

    # 10. Output format — describe structure in prose to avoid JSON double-quote issues
    parts.append(
        f"OUTPUT: Respond with ONLY a JSON object, no prose. "
        f"Keys: session_id (integer {session_id}), "
        "filled (array of objects with field_key and value_entered), "
        "failed (array of objects with field_key and error), "
        "url (current page URL string). "
        "No other text before or after the JSON."
    )

    return "\n\n".join(parts)
