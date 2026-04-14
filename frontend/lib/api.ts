export type JobStatus = {
  job_id: string;
  status: "queued" | "generating" | "merging" | "completed" | "failed";
  progress: number;
  current_clip: number;
  total_clips: number;
  error?: string | null;
  download_url?: string | null;
};

export type GenerateBody = {
  prompts: string[];
  durations: number[];
  aspect_ratio: "16:9" | "9:16";
  resolution: "720p";
  fade: boolean;
};

const API_BASE = "/api";

export async function startJob(body: GenerateBody): Promise<{ job_id: string }> {
  const res = await fetch(`${API_BASE}/generate-videos`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Request failed: ${res.status}`);
  }
  return res.json();
}

export async function pollJob(jobId: string): Promise<JobStatus> {
  const res = await fetch(`${API_BASE}/job/${jobId}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Poll failed: ${res.status}`);
  return res.json();
}

export function downloadUrl(jobId: string): string {
  return `${API_BASE}/download/${jobId}`;
}
