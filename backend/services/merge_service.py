"""Merge a list of MP4 clips into a single output using ffmpeg."""

from __future__ import annotations

import shutil
import subprocess
from pathlib import Path
from typing import List


def _ensure_ffmpeg() -> str:
    exe = shutil.which("ffmpeg")
    if not exe:
        raise RuntimeError("ffmpeg not found on PATH. Install ffmpeg and try again.")
    return exe


def concat_lossless(clips: List[Path], out_path: Path) -> Path:
    """Concat via the demuxer with ``-c copy`` (no re-encode)."""
    ffmpeg = _ensure_ffmpeg()
    list_file = out_path.parent / "concat.txt"
    list_file.write_text(
        "\n".join(f"file '{c.as_posix()}'" for c in clips) + "\n",
        encoding="utf-8",
    )
    cmd = [
        ffmpeg, "-y",
        "-f", "concat",
        "-safe", "0",
        "-i", str(list_file),
        "-c", "copy",
        str(out_path),
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(f"ffmpeg concat failed: {result.stderr.strip()[-800:]}")
    return out_path


def concat_with_fade(clips: List[Path], out_path: Path, fade_duration: float = 0.5) -> Path:
    """Concat with xfade transitions (re-encodes; slower)."""
    ffmpeg = _ensure_ffmpeg()
    if len(clips) == 1:
        # Nothing to fade between — fall back to copy.
        return concat_lossless(clips, out_path)

    # Probe each clip's duration via ffprobe. Assume 10s per clip if probe fails.
    durations: list[float] = []
    ffprobe = shutil.which("ffprobe")
    for c in clips:
        if ffprobe:
            r = subprocess.run(
                [ffprobe, "-v", "error", "-show_entries", "format=duration",
                 "-of", "default=noprint_wrappers=1:nokey=1", str(c)],
                capture_output=True, text=True,
            )
            try:
                durations.append(float(r.stdout.strip()))
                continue
            except ValueError:
                pass
        durations.append(10.0)

    inputs: list[str] = []
    for c in clips:
        inputs.extend(["-i", str(c)])

    # Build xfade filter chain for video.
    v_filter_parts: list[str] = []
    a_filter_parts: list[str] = []
    prev_v = "[0:v]"
    prev_a = "[0:a]"
    offset = durations[0] - fade_duration
    for i in range(1, len(clips)):
        out_v = f"[v{i}]"
        out_a = f"[a{i}]"
        v_filter_parts.append(
            f"{prev_v}[{i}:v]xfade=transition=fade:duration={fade_duration}:offset={offset:.3f}{out_v}"
        )
        a_filter_parts.append(
            f"{prev_a}[{i}:a]acrossfade=d={fade_duration}{out_a}"
        )
        prev_v = out_v
        prev_a = out_a
        offset += durations[i] - fade_duration

    filter_complex = ";".join(v_filter_parts + a_filter_parts)

    cmd = [
        ffmpeg, "-y",
        *inputs,
        "-filter_complex", filter_complex,
        "-map", prev_v,
        "-map", prev_a,
        "-c:v", "libx264", "-pix_fmt", "yuv420p", "-preset", "veryfast", "-crf", "20",
        "-c:a", "aac", "-b:a", "160k",
        "-movflags", "+faststart",
        str(out_path),
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        # Not all clips may have an audio track; retry without audio fades.
        v_only = ";".join(v_filter_parts)
        cmd_v = [
            ffmpeg, "-y",
            *inputs,
            "-filter_complex", v_only,
            "-map", prev_v,
            "-c:v", "libx264", "-pix_fmt", "yuv420p", "-preset", "veryfast", "-crf", "20",
            "-movflags", "+faststart",
            str(out_path),
        ]
        r2 = subprocess.run(cmd_v, capture_output=True, text=True)
        if r2.returncode != 0:
            raise RuntimeError(
                f"ffmpeg xfade failed: {result.stderr.strip()[-400:]} | {r2.stderr.strip()[-400:]}"
            )
    return out_path


def merge(clips: List[Path], out_path: Path, fade: bool = False) -> Path:
    if not clips:
        raise ValueError("No clips to merge.")
    if fade and len(clips) > 1:
        return concat_with_fade(clips, out_path)
    return concat_lossless(clips, out_path)
