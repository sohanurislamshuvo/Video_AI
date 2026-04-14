"use client";

import { useEffect, useRef, useState } from "react";
import PromptList from "@/components/PromptList";
import OptionsBar from "@/components/OptionsBar";
import ProgressBar from "@/components/ProgressBar";
import DownloadCard from "@/components/DownloadCard";
import { downloadUrl, pollJob, startJob, type JobStatus } from "@/lib/api";

type Aspect = "16:9" | "9:16";

export default function Page() {
  const [prompts, setPrompts] = useState<string[]>([""]);
  const [aspect, setAspect] = useState<Aspect>("16:9");
  const [fade, setFade] = useState(false);
  const [job, setJob] = useState<JobStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const busy =
    submitting ||
    (job != null && (job.status === "queued" || job.status === "generating" || job.status === "merging"));

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
    const clean = prompts.map((p) => p.trim()).filter(Boolean);
    if (clean.length === 0) {
      setError("Add at least one prompt.");
      return;
    }
    setSubmitting(true);
    setJob(null);
    try {
      const { job_id } = await startJob({
        prompts: clean,
        aspect_ratio: aspect,
        resolution: "720p",
        fade,
      });
      setJob({
        job_id,
        status: "queued",
        progress: 0,
        current_clip: 0,
        total_clips: clean.length,
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

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:py-16">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Grok Batch Video Generator
        </h1>
        <p className="mt-2 text-sm text-neutral-400">
          Enter one prompt per 10-second clip. They will be generated with{" "}
          <span className="font-mono text-neutral-300">grok-imagine-video</span>{" "}
          and merged in order.
        </p>
      </header>

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
        <PromptList prompts={prompts} disabled={busy} onChange={setPrompts} />
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
          />
        </section>
      )}

      <footer className="mt-16 text-center text-xs text-neutral-600">
        Powered by xAI · Grok Imagine · ffmpeg
      </footer>
    </main>
  );
}
