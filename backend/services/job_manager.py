import time
import uuid
from dataclasses import dataclass, field
from threading import Lock
from typing import Dict, Optional

from utils.files import remove_job

JOB_TTL_SECONDS = 2 * 60 * 60  # 2 hours


@dataclass
class JobState:
    job_id: str
    status: str = "queued"
    progress: int = 0
    current_clip: int = 0
    total_clips: int = 0
    error: Optional[str] = None
    final_path: Optional[str] = None
    created_at: float = field(default_factory=time.time)


class JobManager:
    def __init__(self) -> None:
        self._jobs: Dict[str, JobState] = {}
        self._lock = Lock()

    def create(self, total_clips: int) -> JobState:
        self._gc()
        job_id = uuid.uuid4().hex
        with self._lock:
            state = JobState(job_id=job_id, total_clips=total_clips)
            self._jobs[job_id] = state
        return state

    def get(self, job_id: str) -> Optional[JobState]:
        self._gc()
        with self._lock:
            return self._jobs.get(job_id)

    def update(self, job_id: str, **fields) -> None:
        with self._lock:
            job = self._jobs.get(job_id)
            if not job:
                return
            for k, v in fields.items():
                setattr(job, k, v)

    def _gc(self) -> None:
        now = time.time()
        expired = []
        with self._lock:
            for jid, j in self._jobs.items():
                if now - j.created_at > JOB_TTL_SECONDS:
                    expired.append(jid)
            for jid in expired:
                self._jobs.pop(jid, None)
        for jid in expired:
            remove_job(jid)


jobs = JobManager()
