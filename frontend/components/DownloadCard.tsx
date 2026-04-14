"use client";

type Props = {
  url: string;
  clipCount: number;
  aspect: string;
  totalSeconds: number;
};

export default function DownloadCard({ url, clipCount, aspect, totalSeconds }: Props) {
  return (
    <div className="rounded-2xl border border-emerald-700/40 bg-gradient-to-br from-emerald-900/30 to-neutral-900 p-6 text-center">
      <div className="mb-1 text-xs uppercase tracking-wider text-emerald-400">
        Ready
      </div>
      <h3 className="text-lg font-semibold text-neutral-100">
        Your merged video is ready
      </h3>
      <p className="mt-1 text-sm text-neutral-400">
        {clipCount} clip{clipCount === 1 ? "" : "s"} · {aspect} · ~
        {totalSeconds}s total
      </p>
      <a
        href={url}
        download
        className="mt-4 inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-5 py-3 text-sm font-semibold text-neutral-950 shadow-lg shadow-emerald-900/40 transition hover:bg-emerald-400"
      >
        ↓ Download Final Video
      </a>
    </div>
  );
}
