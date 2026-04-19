"use client";

import { useEffect, useRef, useState } from "react";
import PromptList, { type Clip } from "@/components/PromptList";
import OptionsBar from "@/components/OptionsBar";
import ProgressBar from "@/components/ProgressBar";
import DownloadCard from "@/components/DownloadCard";
import UploadMerge from "@/components/UploadMerge";
import { downloadUrl, pollJob, startJob, type JobStatus } from "@/lib/api";

type Aspect = "16:9" | "9:16";
type Tab = "generate" | "upload";

export default function Page() {
  const [tab, setTab] = useState<Tab>("generate");

  // ── Generate tab state ──────────────────────────────────────────────────
  const [clips, setClips] = useState<Clip[]>([{ prompt: "", duration: 10 }]);
  const [aspect, setAspect] = useState<Aspect>("16:9");
  const [fade, setFade] = useState(false);
  const [job, setJob] = useState<JobStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [lastTotalSeconds, setLastTotalSeconds] = useState<number>(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const busy =
    submitting ||
    (job != null &&
      (job.status === "queued" ||
        job.status === "generating" ||
        job.status === "merging"));

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const stopPolling = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  const beginPolling = (jobId: string) => {
    stopPolling();
    pollRef.current = setInterval(async () => {
      try {
        const next = await pollJob(jobId);
        setJob(next);
        if (next.status === "completed" || next.status === "failed") {
          stopPolling();
          if (next.status === "failed") setError(next.error ?? "Job failed.");
        }
      } catch (e) {
        stopPolling();
        setError(e instanceof Error ? e.message : String(e));
      }
    }, 2000);
  };

  const handleSubmit = async () => {
    setError(null);
    const validClips = clips
      .map((c) => ({ prompt: c.prompt.trim(), duration: c.duration }))
      .filter((c) => c.prompt.length > 0);
    if (validClips.length === 0) {
      setError("Add at least one prompt.");
      return;
    }
    setSubmitting(true);
    setJob(null);
    const totalSeconds = validClips.reduce((s, c) => s + c.duration, 0);
    setLastTotalSeconds(totalSeconds);
    try {
      const { job_id } = await startJob({
        prompts: validClips.map((c) => c.prompt),
        durations: validClips.map((c) => c.duration),
        aspect_ratio: aspect,
        resolution: "720p",
        fade,
      });
      setJob({
        job_id,
        status: "queued",
        progress: 0,
        current_clip: 0,
        total_clips: validClips.length,
      });
      beginPolling(job_id);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  };

  const reset = () => {
    stopPolling();
    setJob(null);
    setError(null);
  };

  // ── Tab button helper ───────────────────────────────────────────────────
  const tabBtn = (value: Tab, label: string, icon: React.ReactNode) => {
    const active = tab === value;
    return (
      <button
        type="button"
        onClick={() => setTab(value)}
        className={`flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition-all
          ${active
            ? value === "upload"
              ? "bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white shadow-lg shadow-violet-900/40"
              : "bg-indigo-500 text-white shadow-lg shadow-indigo-900/40"
            : "border border-neutral-800 bg-neutral-900/60 text-neutral-400 hover:border-neutral-700 hover:text-neutral-200"
          }`}
      >
        {icon}
        {label}
      </button>
    );
  };

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:py-16">
      {/* Header */}
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Grok Batch Video Generator
        </h1>
        <p className="mt-2 text-sm text-neutral-400">
          AI-generate clips from prompts, or upload &amp; merge your own videos.
        </p>
      </header>

      {/* Tab switcher */}
      <div className="mb-8 flex flex-wrap gap-3">
        {tabBtn(
          "generate",
          "AI Generate",
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z" />
          </svg>
        )}
        {tabBtn(
          "upload",
          "Upload & Merge",
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
          </svg>
        )}
      </div>

      {/* ── UPLOAD & MERGE TAB ── */}
      {tab === "upload" && <UploadMerge />}

      {/* ── AI GENERATE TAB ── */}
      {tab === "generate" && (
        <>
          {error && (
            <div className="mb-4 rounded-xl border border-red-800/60 bg-red-950/40 p-4 text-sm text-red-200">
              <strong className="mr-2 font-semibold">Error:</strong>
              {error}
            </div>
          )}

          <section className="mb-6">
            <OptionsBar
              aspect={aspect}
              fade={fade}
              disabled={busy}
              onAspectChange={setAspect}
              onFadeChange={setFade}
            />
          </section>

          <section className="mb-6">
            <PromptList
              clips={clips}
              defaultDuration={10}
              disabled={busy}
              onChange={setClips}
            />
          </section>

          <section className="mb-6 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-500 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-900/40 transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy ? (
                <>
                  <span className="h-2 w-2 animate-pulse rounded-full bg-white" />
                  Working…
                </>
              ) : (
                <>Generate &amp; Merge All Clips</>
              )}
            </button>
            {job && (job.status === "completed" || job.status === "failed") && (
              <button
                type="button"
                onClick={reset}
                className="rounded-xl border border-neutral-800 px-4 py-3 text-sm text-neutral-300 transition hover:border-neutral-700 hover:text-white"
              >
                Start Over
              </button>
            )}
          </section>

          {job && (
            <section className="mb-6">
              <ProgressBar job={job} />
            </section>
          )}

          {job?.status === "completed" && (
            <section>
              <DownloadCard
                url={downloadUrl(job.job_id)}
                clipCount={job.total_clips}
                aspect={aspect}
                totalSeconds={lastTotalSeconds}
              />
            </section>
          )}
        </>
      )}

      <footer className="mt-16 text-center text-xs text-neutral-600">
        Powered by xAI · Grok Imagine · ffmpeg
      </footer>
    </main>
  );
}
