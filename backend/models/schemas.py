from typing import List, Literal, Optional
from pydantic import BaseModel, Field, field_validator, model_validator


AspectRatio = Literal["16:9", "9:16"]
Resolution = Literal["720p"]
JobStatusLiteral = Literal["queued", "generating", "merging", "completed", "failed"]


class GenerateRequest(BaseModel):
    prompts: List[str] = Field(..., min_length=1, max_length=20)
    aspect_ratio: AspectRatio = "16:9"
    resolution: Resolution = "720p"
    fade: bool = False
    # Fallback duration used when ``durations`` is missing or a value is out of range.
    duration: int = Field(10, ge=1, le=10)
    # Optional per-clip durations, parallel to ``prompts``. If omitted, every clip uses ``duration``.
    durations: Optional[List[int]] = None

    @field_validator("prompts")
    @classmethod
    def strip_and_check(cls, v: List[str]) -> List[str]:
        cleaned = [p.strip() for p in v]
        if any(not p for p in cleaned):
            raise ValueError("Prompts must be non-empty strings.")
        return cleaned

    @model_validator(mode="after")
    def check_durations(self) -> "GenerateRequest":
        if self.durations is not None:
            if len(self.durations) != len(self.prompts):
                raise ValueError("`durations` length must match `prompts` length.")
            for d in self.durations:
                if not (1 <= d <= 10):
                    raise ValueError("Each clip duration must be between 1 and 10 seconds.")
        return self

    def resolved_durations(self) -> List[int]:
        if self.durations is not None:
            return list(self.durations)
        return [self.duration] * len(self.prompts)


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
