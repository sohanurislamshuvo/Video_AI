"""Thin wrapper around the official xai-sdk for grok-imagine-video.

The xai-sdk surface has evolved; this module defensively handles several
return shapes (object with .save, .url, .video_url, .content/.bytes) so the
caller only has to call ``generate_clip`` and receive a saved file path.
"""

from __future__ import annotations

import os
import time
from pathlib import Path
from typing import Any

import httpx

MODEL = "grok-imagine-video"


def _get_client():
    api_key = os.environ.get("XAI_API_KEY")
    if not api_key:
        raise RuntimeError("XAI_API_KEY is not set. Copy .env.example to .env and set it.")
    # Import lazily so the backend can start even if xai-sdk has import-time issues.
    from xai_sdk import Client  # type: ignore
    return Client(api_key=api_key)


def _extract_url(obj: Any) -> str | None:
    for attr in ("url", "video_url", "download_url"):
        v = getattr(obj, attr, None)
        if isinstance(v, str) and v.startswith("http"):
            return v
    # Nested .video.url etc.
    inner = getattr(obj, "video", None)
    if inner is not None:
        return _extract_url(inner)
    return None


def _extract_bytes(obj: Any) -> bytes | None:
    for attr in ("content", "bytes", "data"):
        v = getattr(obj, attr, None)
        if isinstance(v, (bytes, bytearray)):
            return bytes(v)
    return None


def _save_to(path: Path, response: Any) -> None:
    # Preferred: SDK-provided save method.
    save_fn = getattr(response, "save", None)
    if callable(save_fn):
        save_fn(str(path))
        return

    data = _extract_bytes(response)
    if data is not None:
        path.write_bytes(data)
        return

    url = _extract_url(response)
    if url:
        with httpx.stream("GET", url, timeout=300.0, follow_redirects=True) as r:
            r.raise_for_status()
            with path.open("wb") as f:
                for chunk in r.iter_bytes():
                    f.write(chunk)
        return

    raise RuntimeError("xAI video response did not expose save(), bytes, or a URL.")


def generate_clip(
    prompt: str,
    out_path: Path,
    *,
    duration: int = 10,
    aspect_ratio: str = "16:9",
    resolution: str = "720p",
    max_retries: int = 1,
) -> Path:
    """Generate one clip for ``prompt`` and write it to ``out_path``."""
    client = _get_client()
    last_err: Exception | None = None
    for attempt in range(max_retries + 1):
        try:
            response = client.video.generate(  # type: ignore[attr-defined]
                model=MODEL,
                prompt=prompt,
                duration=duration,
                aspect_ratio=aspect_ratio,
                resolution=resolution,
            )
            _save_to(out_path, response)
            if not out_path.exists() or out_path.stat().st_size == 0:
                raise RuntimeError("xAI returned an empty video file.")
            return out_path
        except Exception as e:  # noqa: BLE001 — propagate after retries
            last_err = e
            if attempt < max_retries:
                time.sleep(2.0)
                continue
            raise
    assert last_err is not None
    raise last_err
