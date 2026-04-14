from typing import List, Literal, Optional
from pydantic import BaseModel, Field, field_validator


AspectRatio = Literal["16:9", "9:16"]
Resolution = Literal["720p"]
JobStatusLiteral = Literal["queued", "generating", "merging", "completed", "failed"]


class GenerateRequest(BaseModel):
    prompts: List[str] = Field(..., min_length=1, max_length=20)
    aspect_ratio: AspectRatio = "16:9"
    resolution: Resolution = "720p"
    fade: bool = False

    @field_validator("prompts")
    @classmethod
    def strip_and_check(cls, v: List[str]) -> List[str]:
        cleaned = [p.strip() for p in v]
        if any(not p for p in cleaned):
            raise ValueError("Prompts must be non-empty strings.")
        return cleaned


class GenerateResponse(BaseModel):
    job_id: str


class JobStatus(BaseModel):
    job_id: str
    status: JobStatusLiteral
    progress: int
    current_clip: int
    total_clips: int
    error: Optional[str] = None
    download_url: Optional[str] = None
