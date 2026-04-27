from __future__ import annotations

import threading
from pathlib import Path
from typing import List

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
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


# ---------------------------------------------------------------------------
# Upload & Merge  (new feature)
# ---------------------------------------------------------------------------

ALLOWED_MIME = {"video/mp4", "video/quicktime", "video/x-matroska", "video/webm", "video/avi"}
MAX_UPLOAD_VIDEOS = 10


def _run_merge_uploads(job_id: str, saved_clips: List[Path], fade: bool) -> None:
    """Background thread: merge pre-saved upload clips and finalise the job."""
    try:
        jobs.update(job_id, status="merging", progress=10, current_clip=len(saved_clips))
        out_final = final_path(job_id)
        if fade:
            merge_service.merge(saved_clips, out_final, fade=True)
        else:
            try:
                merge_service.merge(saved_clips, out_final, seamless=False)
            except RuntimeError:
                merge_service.merge(saved_clips, out_final, seamless=True)
        jobs.update(
            job_id,
            status="completed",
            progress=100,
            final_path=str(out_final),
        )
    except Exception as e:  # noqa: BLE001
        jobs.update(job_id, status="failed", error=str(e))


@router.post("/merge-uploads", response_model=GenerateResponse)
async def merge_uploads(
    files: List[UploadFile] = File(..., description="1–10 video files to merge in order"),
    fade: bool = Form(False),
) -> GenerateResponse:
    """Accept up to 10 uploaded video files and merge them into a single MP4."""
    if not files:
        raise HTTPException(status_code=422, detail="Upload at least one video file.")
    if len(files) > MAX_UPLOAD_VIDEOS:
        raise HTTPException(
            status_code=422,
            detail=f"Maximum {MAX_UPLOAD_VIDEOS} videos allowed, got {len(files)}.",
        )

    state = jobs.create(total_clips=len(files))
    jdir = job_dir(state.job_id)
    jobs.update(state.job_id, status="queued", progress=5)

    # Save uploaded files using the async API — do NOT use shutil.copyfileobj
    # or upload.file directly inside an async endpoint; that reads a sync-backed
    # SpooledTemporaryFile and can reset the socket mid-stream.
    saved_clips: List[Path] = []
    for i, upload in enumerate(files):
        # Best-effort MIME check (browsers sometimes send octet-stream).
        if upload.content_type and upload.content_type not in ALLOWED_MIME:
            jobs.update(state.job_id, status="failed",
                        error=f"File {i + 1} has unsupported type '{upload.content_type}'.")
            raise HTTPException(
                status_code=422,
                detail=f"File {i + 1}: unsupported content type '{upload.content_type}'.",
            )
        suffix = Path(upload.filename or "video.mp4").suffix or ".mp4"
        dest = jdir / f"upload_{i:03d}{suffix}"
        content = await upload.read()   # ✅ correct async read
        dest.write_bytes(content)
        saved_clips.append(dest)
        jobs.update(state.job_id, progress=5 + round((i + 1) / len(files) * 5))

    # Merge on a daemon thread so this request returns immediately.
    t = threading.Thread(
        target=_run_merge_uploads,
        args=(state.job_id, saved_clips, fade),
        daemon=True,
    )
    t.start()
    return GenerateResponse(job_id=state.job_id)
