"use client";

import { useEffect, useRef, useState } from "react";
import { downloadUrl, pollJob, uploadAndMerge, type JobStatus } from "@/lib/api";
import ProgressBar from "@/components/ProgressBar";
import DownloadCard from "@/components/DownloadCard";

const MAX_FILES = 10;
const ACCEPTED = "video/mp4,video/quicktime,video/x-matroska,video/webm,video/avi,.mp4,.mov,.mkv,.webm,.avi";

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function UploadMerge() {
  const [files, setFiles] = useState<File[]>([]);
  const [fade, setFade] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [job, setJob] = useState<JobStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const busy =
    submitting ||
    (job != null &&
      (job.status === "queued" || job.status === "merging"));

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
          if (next.status === "failed") setError(next.error ?? "Merge failed.");
        }
      } catch (e) {
        stopPolling();
        setError(e instanceof Error ? e.message : String(e));
      }
    }, 2000);
  };

  const addFiles = (incoming: FileList | null) => {
    if (!incoming) return;
    const next = [...files];
    for (const f of Array.from(incoming)) {
      if (next.length >= MAX_FILES) break;
      // Avoid duplicates by name+size
      if (!next.find((x) => x.name === f.name && x.size === f.size)) {
        next.push(f);
      }
    }
    setFiles(next);
  };

  const remove = (i: number) => setFiles(files.filter((_, idx) => idx !== i));

  const moveUp = (i: number) => {
    if (i === 0) return;
    const next = files.slice();
    [next[i - 1], next[i]] = [next[i], next[i - 1]];
    setFiles(next);
  };

  const moveDown = (i: number) => {
    if (i === files.length - 1) return;
    const next = files.slice();
    [next[i], next[i + 1]] = [next[i + 1], next[i]];
    setFiles(next);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    addFiles(e.dataTransfer.files);
  };

  const handleSubmit = async () => {
    setError(null);
    if (files.length === 0) {
      setError("Add at least one video file.");
      return;
    }
    setSubmitting(true);
    setJob(null);
    try {
      const { job_id } = await uploadAndMerge(files, fade);
      setJob({
        job_id,
        status: "queued",
        progress: 0,
        current_clip: 0,
        total_clips: files.length,
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
    setFiles([]);
  };

  const totalBytes = files.reduce((s, f) => s + f.size, 0);

  return (
    <div className="space-y-6">
      {/* Error */}
      {error && (
        <div className="rounded-xl border border-red-800/60 bg-red-950/40 p-4 text-sm text-red-200">
          <strong className="mr-2 font-semibold">Error:</strong>
          {error}
        </div>
      )}

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => !busy && inputRef.current?.click()}
        className={`relative flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-6 py-12 text-center transition-all
          ${dragging
            ? "border-violet-400 bg-violet-900/20 scale-[1.01]"
            : "border-neutral-700 bg-neutral-900/40 hover:border-violet-500 hover:bg-violet-900/10"
          }
          ${busy ? "cursor-not-allowed opacity-60" : ""}`}
      >
        {/* Upload icon */}
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-violet-600 to-fuchsia-600 shadow-lg shadow-violet-900/50">
          <svg className="h-7 w-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
          </svg>
        </div>

        <div>
          <p className="text-sm font-semibold text-neutral-200">
            {dragging ? "Drop videos here" : "Drag & drop videos here"}
          </p>
          <p className="mt-1 text-xs text-neutral-500">
            or click to browse · MP4, MOV, MKV, WebM, AVI · up to {MAX_FILES} files
          </p>
        </div>

        {files.length > 0 && (
          <div className="mt-1 text-xs text-violet-400">
            {files.length} file{files.length > 1 ? "s" : ""} selected · {formatBytes(totalBytes)} total
          </div>
        )}

        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED}
          multiple
          className="hidden"
          disabled={busy}
          onChange={(e) => addFiles(e.target.files)}
        />
      </div>

      {/* File list */}
      {files.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs uppercase tracking-wider text-neutral-500">
              Merge order ({files.length}/{MAX_FILES})
            </p>
            {!busy && (
              <button
                type="button"
                onClick={() => setFiles([])}
                className="text-xs text-neutral-500 transition hover:text-red-400"
              >
                Clear all
              </button>
            )}
          </div>

          {files.map((f, i) => (
            <div
              key={`${f.name}-${f.size}-${i}`}
              className="flex items-center gap-3 rounded-xl border border-neutral-800 bg-neutral-900/60 px-4 py-3"
            >
              {/* Index badge */}
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-violet-600/30 text-xs font-bold text-violet-300">
                {i + 1}
              </span>

              {/* Video icon */}
              <svg className="h-5 w-5 shrink-0 text-neutral-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" />
              </svg>

              {/* Name + size */}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-neutral-200">{f.name}</p>
                <p className="text-xs text-neutral-500">{formatBytes(f.size)}</p>
              </div>

              {/* Reorder + remove */}
              {!busy && (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => moveUp(i)}
                    disabled={i === 0}
                    title="Move up"
                    className="rounded p-1 text-neutral-400 transition hover:bg-neutral-800 hover:text-neutral-100 disabled:opacity-30"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => moveDown(i)}
                    disabled={i === files.length - 1}
                    title="Move down"
                    className="rounded p-1 text-neutral-400 transition hover:bg-neutral-800 hover:text-neutral-100 disabled:opacity-30"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(i)}
                    title="Remove"
                    className="ml-1 rounded p-1 text-neutral-500 transition hover:bg-red-900/30 hover:text-red-400"
                  >
                    ✕
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Options */}
      <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-neutral-300">
        <input
          type="checkbox"
          checked={fade}
          disabled={busy}
          onChange={(e) => setFade(e.target.checked)}
          className="h-4 w-4 rounded border-neutral-700 bg-neutral-900 text-violet-500 focus:ring-violet-500"
        />
        Fade transitions between clips
      </label>

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={busy || files.length === 0}
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-violet-900/40 transition hover:from-violet-500 hover:to-fuchsia-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? (
            <>
              <span className="h-2 w-2 animate-pulse rounded-full bg-white" />
              Merging…
            </>
          ) : (
            <>Merge {files.length > 0 ? `${files.length} ` : ""}Videos</>
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
      </div>

      {/* Progress */}
      {job && (
        <section>
          <ProgressBar job={job} />
        </section>
      )}

      {/* Download */}
      {job?.status === "completed" && (
        <section>
          <DownloadCard
            url={downloadUrl(job.job_id)}
            clipCount={job.total_clips}
            aspect="—"
            totalSeconds={0}
          />
        </section>
      )}
    </div>
  );
}
