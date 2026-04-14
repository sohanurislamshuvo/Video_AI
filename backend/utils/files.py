import os
import shutil
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
TEMP_DIR = BASE_DIR / "temp"
JOBS_DIR = TEMP_DIR / "jobs"


def ensure_dirs() -> None:
    JOBS_DIR.mkdir(parents=True, exist_ok=True)


def job_dir(job_id: str) -> Path:
    d = JOBS_DIR / job_id
    d.mkdir(parents=True, exist_ok=True)
    return d


def clip_path(job_id: str, index: int) -> Path:
    return job_dir(job_id) / f"clip_{index:03d}.mp4"


def final_path(job_id: str) -> Path:
    return job_dir(job_id) / "final.mp4"


def remove_job(job_id: str) -> None:
    d = JOBS_DIR / job_id
    if d.exists():
        shutil.rmtree(d, ignore_errors=True)
