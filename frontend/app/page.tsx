"use client";

import { useMemo, useState } from "react";

type ApiResult = { ok: boolean; message: string };

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function Home() {
  const BACKEND_BASE =
  process.env.NEXT_PUBLIC_BACKEND_BASE ||
  "https://waterlooworks-webapp.onrender.com";


  const [files, setFiles] = useState<File[]>([]);
  const [resumeText, setResumeText] = useState<string>("");

  // BYOK
  const [openaiKey, setOpenaiKey] = useState<string>("");

  const [busy, setBusy] = useState<"none" | "analyze" | "letters">("none");
  const [status, setStatus] = useState<ApiResult | null>(null);

  const totalSizeMB = useMemo(() => {
    const total = files.reduce((sum, f) => sum + f.size, 0);
    return (total / (1024 * 1024)).toFixed(2);
  }, [files]);

  function onPickFiles(list: FileList | null) {
    if (!list) return;
    setStatus(null);

    const picked = Array.from(list);
    const pdfs = picked.filter(
      (f) => f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf"),
    );
    setFiles(pdfs);
  }

  async function handleAnalyze() {
    setStatus(null);

    if (files.length === 0) {
      setStatus({ ok: false, message: "Upload at least one PDF first." });
      return;
    }

    setBusy("analyze");
    try {
      const form = new FormData();
      for (const f of files) form.append("files", f);

      const res = await fetch(`${BACKEND_BASE}/v1/batch/analyze`, {
        method: "POST",
        body: form,
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Analyze failed with status ${res.status}`);
      }

      const blob = await res.blob();
      downloadBlob(blob, "analysis.csv");
      setStatus({ ok: true, message: `Downloaded analysis.csv for ${files.length} job(s).` });
    } catch (err: any) {
      setStatus({ ok: false, message: err?.message ?? "Analyze failed." });
    } finally {
      setBusy("none");
    }
  }

  async function handleCoverLetters() {
    setStatus(null);

    if (files.length === 0) {
      setStatus({ ok: false, message: "Upload at least one PDF first." });
      return;
    }
    if (resumeText.trim().length < 30) {
      setStatus({
        ok: false,
        message: "Paste your resume text (at least ~30 characters) before generating cover letters.",
      });
      return;
    }

    // IMPORTANT: Public demo should REQUIRE BYOK
    if (openaiKey.trim().length < 10) {
      setStatus({
        ok: false,
        message:
          "Cover letters require an OpenAI API key (BYOK). Paste your key to generate cover letters. Analyze does NOT require a key.",
      });
      return;
    }

    setBusy("letters");
    try {
      const form = new FormData();
      for (const f of files) form.append("files", f);
      form.append("resume_text", resumeText);
      form.append("openai_api_key", openaiKey.trim());

      const res = await fetch(`${BACKEND_BASE}/v1/batch/cover-letters`, {
        method: "POST",
        body: form,
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Cover letters failed with status ${res.status}`);
      }

      const blob = await res.blob();
      downloadBlob(blob, "cover_letters.zip");
      setStatus({ ok: true, message: `Downloaded cover_letters.zip for ${files.length} job(s).` });
    } catch (err: any) {
      setStatus({ ok: false, message: err?.message ?? "Cover letter generation failed." });
    } finally {
      setBusy("none");
    }
  }

  const analyzeReady = files.length > 0;
  const lettersReady = files.length > 0 && resumeText.trim().length >= 30 && openaiKey.trim().length >= 10;

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-950 to-slate-900 text-slate-100">
      <div className="mx-auto max-w-5xl px-6 py-10">
        {/* Header */}
        <div className="flex flex-col gap-2">
          <div className="inline-flex w-fit items-center gap-2 rounded-full bg-white/5 px-4 py-2 text-sm text-slate-200 ring-1 ring-white/10">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            WaterlooWorks Job Analyzer — Full-Stack
          </div>

          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Upload job PDFs → download a CSV + AI cover letters
          </h1>

          <p className="max-w-2xl text-slate-300">
            <b>Analyze</b> is free (no key needed). <b>Cover letters</b> require a user-provided OpenAI API key (BYOK) because it makes a paid API call.
          </p>
        </div>

        {/* Demo / Testing Guide */}
        <section className="mt-8 rounded-2xl bg-white/5 p-6 ring-1 ring-white/10 backdrop-blur">
          <h2 className="text-lg font-semibold">Quick Demo / Testing Guide</h2>
          <p className="mt-1 text-sm text-slate-300">
            Use the included sample PDFs to test quickly. They live in{" "}
            <code className="text-slate-200">frontend/public/demo_pdfs</code>.
          </p>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            {/* IMPORTANT: This assumes you placed demo_pdfs.zip in /public */}
            <a
              href="/demo_pdfs.zip"
              download
              className="inline-flex items-center justify-center rounded-xl bg-white/5 px-5 py-3 text-sm font-semibold text-slate-100 ring-1 ring-white/10 hover:bg-white/10"
            >
              Download Demo PDFs (ZIP)
            </a>

            <a
              href={`${BACKEND_BASE}/docs`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center rounded-xl bg-white/5 px-5 py-3 text-sm font-semibold text-slate-100 ring-1 ring-white/10 hover:bg-white/10"
            >
              Open Backend API Docs
            </a>
          </div>

          <ol className="mt-5 list-decimal space-y-2 pl-5 text-sm text-slate-300">
            <li>
              Start backend:
              <span className="ml-2 rounded bg-black/30 px-2 py-1 font-mono text-xs text-slate-200 ring-1 ring-white/10">
                cd backend && py -m uvicorn main:app --reload
              </span>
            </li>
            <li>
              Start frontend:
              <span className="ml-2 rounded bg-black/30 px-2 py-1 font-mono text-xs text-slate-200 ring-1 ring-white/10">
                cd frontend && npm run dev
              </span>
            </li>
            <li>
              Upload PDFs → click <b>Analyze</b> → downloads <code>analysis.csv</code> (no key needed).
            </li>
            <li>
              Paste resume text + paste OpenAI key → click <b>Generate</b> → downloads <code>cover_letters.zip</code>.
            </li>
          </ol>

          <div className="mt-4 rounded-xl bg-black/20 p-4 text-xs text-slate-400 ring-1 ring-white/10">
            <b>BYOK:</b> This demo does <b>not</b> provide a server key. If you want cover letters, you must paste your own OpenAI key.
            The app does not store your key (it is only sent in the request).
          </div>
        </section>

        {/* Cards */}
        <div className="mt-10 grid gap-6 lg:grid-cols-2">
          {/* Upload */}
          <section className="rounded-2xl bg-white/5 p-6 ring-1 ring-white/10 backdrop-blur">
            <h2 className="text-lg font-semibold">1) Upload job PDFs</h2>
            <p className="mt-1 text-sm text-slate-300">Select one or many WaterlooWorks PDF postings.</p>

            <div className="mt-5 rounded-xl border border-dashed border-white/20 bg-white/5 p-5">
              <input
                type="file"
                multiple
                accept=".pdf,application/pdf"
                onChange={(e) => onPickFiles(e.target.files)}
                className="block w-full cursor-pointer text-sm text-slate-200 file:mr-4 file:rounded-lg file:border-0 file:bg-slate-200 file:px-4 file:py-2 file:text-slate-900 hover:file:bg-white"
              />

              <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-slate-300">
                <span className="rounded-full bg-white/5 px-3 py-1 ring-1 ring-white/10">
                  Files: <span className="text-slate-100">{files.length}</span>
                </span>
                <span className="rounded-full bg-white/5 px-3 py-1 ring-1 ring-white/10">
                  Total size: <span className="text-slate-100">{totalSizeMB} MB</span>
                </span>
              </div>

              {files.length > 0 && (
                <div className="mt-4 max-h-40 overflow-auto rounded-lg bg-black/20 p-3 text-xs text-slate-200 ring-1 ring-white/10">
                  {files.map((f) => (
                    <div key={f.name} className="flex items-center justify-between gap-2 py-1">
                      <span className="truncate">{f.name}</span>
                      <span className="shrink-0 text-slate-400">{(f.size / 1024).toFixed(0)} KB</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* Resume + Key */}
          <section className="rounded-2xl bg-white/5 p-6 ring-1 ring-white/10 backdrop-blur">
            <h2 className="text-lg font-semibold">2) Resume + OpenAI Key (only for cover letters)</h2>
            <p className="mt-1 text-sm text-slate-300">
              <b>Analyze:</b> no key required. <b>Cover letters:</b> requires your key (BYOK) because it triggers a paid API call.
            </p>

            <textarea
              value={resumeText}
              onChange={(e) => setResumeText(e.target.value)}
              placeholder="Paste your resume text here (required for cover letters)..."
              className="mt-5 h-40 w-full resize-none rounded-xl bg-black/30 p-4 text-sm text-slate-100 outline-none ring-1 ring-white/10 placeholder:text-slate-500 focus:ring-2 focus:ring-emerald-400/60"
            />

            <div className="mt-3 text-xs text-slate-400">
              Tip: Plain text is best. Bullet points are fine.
            </div>

            <div className="mt-5">
              <label className="text-sm font-medium text-slate-200">
                OpenAI API Key <span className="text-rose-200">(required for cover letters)</span>
              </label>
              <p className="mt-1 text-xs text-slate-400">
                Your key is used only for this request and is not stored. You can keep your OpenAI monthly budget capped.
              </p>

              <input
                value={openaiKey}
                onChange={(e) => setOpenaiKey(e.target.value)}
                placeholder="sk-..."
                type="password"
                className="mt-2 w-full rounded-xl bg-black/30 px-4 py-3 text-sm text-slate-100 outline-none ring-1 ring-white/10 placeholder:text-slate-500 focus:ring-2 focus:ring-emerald-400/60"
              />

              {openaiKey.trim().length === 0 && (
                <div className="mt-2 text-xs text-amber-300/90">
                  Cover letters won’t run until you paste an OpenAI key. (Analyze will still work.)
                </div>
              )}
            </div>
          </section>
        </div>

        {/* Actions */}
        <section className="mt-6 rounded-2xl bg-white/5 p-6 ring-1 ring-white/10 backdrop-blur">
          <h2 className="text-lg font-semibold">3) Run</h2>
          <p className="mt-1 text-sm text-slate-300">
            Analyze returns a CSV. Cover letters returns a ZIP with one <code>.txt</code> per job.
          </p>

          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <button
              onClick={handleAnalyze}
              disabled={busy !== "none" || !analyzeReady}
              className="inline-flex items-center justify-center rounded-xl bg-slate-100 px-5 py-3 text-sm font-semibold text-slate-900 hover:bg-white disabled:opacity-50"
              title={!analyzeReady ? "Upload at least one PDF to enable Analyze." : ""}
            >
              {busy === "analyze" ? "Analyzing..." : "Analyze → Download CSV"}
            </button>

            <button
              onClick={handleCoverLetters}
              disabled={busy !== "none" || !lettersReady}
              className="inline-flex items-center justify-center rounded-xl bg-emerald-500 px-5 py-3 text-sm font-semibold text-emerald-950 hover:bg-emerald-400 disabled:opacity-50"
              title={
                !lettersReady
                  ? "To enable: upload PDFs + paste resume text + paste OpenAI key."
                  : ""
              }
            >
              {busy === "letters" ? "Generating..." : "Generate → Download ZIP"}
            </button>

            <button
              onClick={() => {
                setFiles([]);
                setResumeText("");
                setOpenaiKey("");
                setStatus(null);
              }}
              disabled={busy !== "none"}
              className="inline-flex items-center justify-center rounded-xl bg-white/5 px-5 py-3 text-sm font-semibold text-slate-100 ring-1 ring-white/10 hover:bg-white/10 disabled:opacity-50"
            >
              Reset
            </button>
          </div>

          {status && (
            <div
              className={`mt-5 rounded-xl p-4 text-sm ring-1 ${
                status.ok
                  ? "bg-emerald-500/10 text-emerald-200 ring-emerald-400/20"
                  : "bg-rose-500/10 text-rose-200 ring-rose-400/20"
              }`}
            >
              {status.message}
            </div>
          )}

          <div className="mt-6 text-xs text-slate-500">
            Backend expected at <span className="text-slate-300">{BACKEND_BASE}</span>. Keep FastAPI running while using the UI.
          </div>
        </section>

        {/* Footer */}
        <footer className="mt-10 text-xs text-slate-500">
          v1: no accounts · unlimited batch · CSV + ZIP downloads · FastAPI + Next.js · BYOK OpenAI for cover letters
        </footer>
      </div>
    </main>
  );
}
