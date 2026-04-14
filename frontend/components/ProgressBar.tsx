"use client";

import type { JobStatus } from "@/lib/api";

const LABEL: Record<JobStatus["status"], string> = {
  queued: "Queued",
  generating: "Generating clips",
  merging: "Merging clips",
  completed: "Completed",
  failed: "Failed",
};

export default function ProgressBar({ job }: { job: JobStatus }) {
  const pct = Math.min(100, Math.max(0, job.progress));
  const color =
    job.status === "failed"
      ? "bg-red-500"
      : job.status === "completed"
      ? "bg-emerald-500"
      : "bg-gradient-to-r from-indigo-500 to-fuchsia-500";

  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-4">
      <div className="mb-2 flex items-center justify-between text-sm">
        <span className="font-medium text-neutral-200">{LABEL[job.status]}</span>
        <span className="tabular-nums text-neutral-400">{pct}%</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-800">
        <div
          className={`h-full ${color} transition-all duration-500`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {job.status === "generating" && job.total_clips > 0 && (
        <div className="mt-2 text-xs text-neutral-400">
          Clip {job.current_clip} of {job.total_clips}
        </div>
      )}
    </div>
  );
}
