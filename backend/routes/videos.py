from __future__ import annotations

import threading
from pathlib import Path
from typing import List

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

from models.schemas import GenerateRequest, GenerateResponse, JobStatus
from services import merge_service, xai_service
from services.job_manager import jobs
from utils.files import clip_path, final_path, job_dir

router = APIRouter()


def _run_job(
    job_id: str,
    prompts: List[str],
    durations: List[int],
    aspect_ratio: str,
    resolution: str,
    fade: bool,
) -> None:
    try:
        jobs.update(job_id, status="generating", progress=0, current_clip=0)
        job_dir(job_id)
        clips: list[Path] = []
        total = len(prompts)

        for i, prompt in enumerate(prompts):
            jobs.update(job_id, current_clip=i + 1)
            out = clip_path(job_id, i)
            xai_service.generate_clip(
                prompt=prompt,
                out_path=out,
                duration=durations[i],
                aspect_ratio=aspect_ratio,
                resolution=resolution,
            )
            clips.append(out)
            # Generation contributes up to 80% of progress.
            jobs.update(job_id, progress=round((i + 1) / total * 80))

        jobs.update(job_id, status="merging", progress=85)
        out_final = final_path(job_id)
        merge_service.merge(clips, out_final, fade=fade)

        jobs.update(
            job_id,
            status="completed",
            progress=100,
            final_path=str(out_final),
        )
    except Exception as e:  # noqa: BLE001 — surfaced to client
        jobs.update(job_id, status="failed", error=str(e))


@router.post("/generate-videos", response_model=GenerateResponse)
def generate_videos(req: GenerateRequest) -> GenerateResponse:
    state = jobs.create(total_clips=len(req.prompts))
    # Use a dedicated thread so the request returns instantly even if the SDK call is blocking.
    t = threading.Thread(
        target=_run_job,
        args=(
            state.job_id,
            req.prompts,
            req.resolved_durations(),
            req.aspect_ratio,
            req.resolution,
            req.fade,
        ),
        daemon=True,
    )
    t.start()
    return GenerateResponse(job_id=state.job_id)


@router.get("/job/{job_id}", response_model=JobStatus)
def get_job(job_id: str) -> JobStatus:
    state = jobs.get(job_id)
    if not state:
        raise HTTPException(status_code=404, detail="Job not found.")
    download_url = f"/download/{job_id}" if state.status == "completed" else None
    return JobStatus(
        job_id=state.job_id,
        status=state.status,  # type: ignore[arg-type]
        progress=state.progress,
        current_clip=state.current_clip,
        total_clips=state.total_clips,
        error=state.error,
        download_url=download_url,
    )


@router.get("/download/{job_id}")
def download_final(job_id: str):
    state = jobs.get(job_id)
    if not state or not state.final_path:
        raise HTTPException(status_code=404, detail="Final video not available.")
    path = Path(state.final_path)
    if not path.exists():
        raise HTTPException(status_code=410, detail="Final video was cleaned up.")
    return FileResponse(
        path,
        media_type="video/mp4",
        filename=f"grok-video-{job_id[:8]}.mp4",
    )
