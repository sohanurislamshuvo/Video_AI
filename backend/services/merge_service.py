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


def _has_audio(clip: Path) -> bool:
    """Return True if the clip contains at least one audio stream."""
    ffprobe = shutil.which("ffprobe")
    if not ffprobe:
        return True  # assume audio if ffprobe is missing
    r = subprocess.run(
        [
            ffprobe, "-v", "error",
            "-select_streams", "a:0",
            "-show_entries", "stream=codec_type",
            "-of", "default=noprint_wrappers=1:nokey=1",
            str(clip),
        ],
        capture_output=True, text=True,
    )
    return r.stdout.strip().lower() == "audio"


def concat_seamless(clips: List[Path], out_path: Path) -> Path:
    """Re-encode using the concat video+audio filter.

    Unlike the concat *demuxer* (-c copy), the concat *filter* resets
    presentation timestamps at every join point → zero gap between clips.

    Audio handling:
    - Clips **with** audio  → their audio stream is used directly.
    - Clips **without** audio → a silent ``anullsrc`` track is generated so
      that audio from *other* clips is never accidentally dropped.
    - If **no** clip has audio → video-only output (no silent track added).
    """
    ffmpeg = _ensure_ffmpeg()
    n = len(clips)

    inputs: list[str] = []
    for c in clips:
        inputs.extend(["-i", str(c)])

    # Probe every clip once.
    audio_flags = [_has_audio(c) for c in clips]
    any_audio = any(audio_flags)

    filter_parts: list[str] = []
    video_labels: list[str] = []
    audio_labels: list[str] = []

    for i, has_a in enumerate(audio_flags):
        video_labels.append(f"[{i}:v:0]")
        if has_a:
            audio_labels.append(f"[{i}:a:0]")
        else:
            # Inject a silent audio source for this clip so we don't lose
            # audio from the other clips that do have sound.
            silent_label = f"[sil{i}]"
            filter_parts.append(
                f"anullsrc=channel_layout=stereo:sample_rate=44100{silent_label}"
            )
            audio_labels.append(silent_label)

    if any_audio:
        stream_spec = "".join(f"{v}{a}" for v, a in zip(video_labels, audio_labels))
        filter_parts.append(
            f"{stream_spec}concat=n={n}:v=1:a=1[outv][outa]"
        )
        filter_complex = ";".join(filter_parts)
        cmd = [
            ffmpeg, "-y",
            *inputs,
            "-filter_complex", filter_complex,
            "-map", "[outv]",
            "-map", "[outa]",
            "-c:v", "libx264", "-pix_fmt", "yuv420p", "-preset", "ultrafast", "-crf", "23",
            "-threads", "1",
            "-c:a", "aac", "-b:a", "128k",
            "-movflags", "+faststart",
            str(out_path),
        ]
    else:
        # No clips have audio — produce a video-only file.
        stream_v = "".join(video_labels)
        filter_parts.append(f"{stream_v}concat=n={n}:v=1:a=0[outv]")
        filter_complex = ";".join(filter_parts)
        cmd = [
            ffmpeg, "-y",
            *inputs,
            "-filter_complex", filter_complex,
            "-map", "[outv]",
            "-c:v", "libx264", "-pix_fmt", "yuv420p", "-preset", "ultrafast", "-crf", "23",
            "-threads", "1",
            "-movflags", "+faststart",
            str(out_path),
        ]

    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(
            f"ffmpeg seamless concat failed:\n{result.stderr.strip()[-1000:]}"
        )
    return out_path



def concat_with_fade(clips: List[Path], out_path: Path, fade_duration: float = 0.5) -> Path:
    """Concat with xfade transitions (re-encodes; slower)."""
    ffmpeg = _ensure_ffmpeg()
    if len(clips) == 1:
        # Nothing to fade between — fall back to seamless concat.
        return concat_seamless(clips, out_path)

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
        "-c:v", "libx264", "-pix_fmt", "yuv420p", "-preset", "ultrafast", "-crf", "23",
        "-threads", "1",
        "-c:a", "aac", "-b:a", "128k",
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
            "-c:v", "libx264", "-pix_fmt", "yuv420p", "-preset", "ultrafast", "-crf", "23",
            "-threads", "1",
            "-movflags", "+faststart",
            str(out_path),
        ]
        r2 = subprocess.run(cmd_v, capture_output=True, text=True)
        if r2.returncode != 0:
            raise RuntimeError(
                f"ffmpeg xfade failed: {result.stderr.strip()[-400:]} | {r2.stderr.strip()[-400:]}"
            )
    return out_path


def merge(clips: List[Path], out_path: Path, fade: bool = False,
          seamless: bool = False) -> Path:
    """Merge clips.

    Args:
        clips:    list of source clip paths in playback order.
        out_path: destination MP4.
        fade:     add xfade crossfade transitions between clips.
        seamless: use the concat filter (re-encode) for zero-gap cuts.
                  Set automatically for user-uploaded clips; AI-generated
                  clips from the same model can use the fast lossless path.
    """
    if not clips:
        raise ValueError("No clips to merge.")
    if fade and len(clips) > 1:
        return concat_with_fade(clips, out_path)
    if seamless or len(clips) == 1:
        return concat_seamless(clips, out_path)
    return concat_lossless(clips, out_path)
