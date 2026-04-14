# Grok Batch Video Generator

Generate multiple 10-second clips with xAI's `grok-imagine-video` model and
merge them, in order, into a single MP4 using `ffmpeg`.

## Stack
- Backend: FastAPI + official `xai-sdk` + `ffmpeg`
- Frontend: Next.js 14 (App Router) + TypeScript + Tailwind CSS

## Prerequisites
- Python 3.10+
- Node.js 18+
- `ffmpeg` on PATH (verify with `ffmpeg -version`)
- xAI API key from https://console.x.ai

## Backend — setup & run
```bash
cd backend
python -m venv .venv
# Windows:
.venv\Scripts\activate
# macOS/Linux:
# source .venv/bin/activate

pip install -r requirements.txt
cp .env.example .env           # then edit .env and set XAI_API_KEY
uvicorn main:app --reload --port 8000
```
Swagger UI: http://localhost:8000/docs

## Frontend — setup & run
```bash
cd frontend
npm install
npm run dev
```
Open http://localhost:3000. The frontend proxies `/api/*` to the backend
(`http://localhost:8000` by default). Override with
`NEXT_PUBLIC_BACKEND_URL` at build/start time.

## API

### `POST /generate-videos`
```json
{
  "prompts": ["a cat surfing", "a cat landing on sand"],
  "aspect_ratio": "16:9",
  "resolution": "720p",
  "fade": false
}
```
Response: `{ "job_id": "…" }`

### `GET /job/{job_id}`
```json
{
  "job_id": "…",
  "status": "generating",
  "progress": 40,
  "current_clip": 1,
  "total_clips": 2,
  "error": null,
  "download_url": null
}
```
`status ∈ queued | generating | merging | completed | failed`.

### `GET /download/{job_id}`
Streams the merged `final.mp4` once the job is complete.

## How merging works
- Default: `ffmpeg -f concat -safe 0 -i concat.txt -c copy final.mp4`
  (lossless, instant, assumes all clips share codec/params — they will when
  they come from the same model/resolution).
- With `fade: true`: re-encodes with an `xfade` chain (0.5s per transition).

## Project layout
```
backend/
  main.py
  routes/videos.py
  services/{xai_service,merge_service,job_manager}.py
  models/schemas.py
  utils/files.py
  temp/jobs/<id>/clip_000.mp4 … final.mp4
frontend/
  app/{layout,page,globals.css}
  components/{PromptList,OptionsBar,ProgressBar,DownloadCard}.tsx
  lib/api.ts
```

## Notes
- Jobs live in memory and are garbage-collected after 2 hours. For
  multi-worker deployments, swap `services/job_manager.py` for Redis.
- `xai_service.py` defensively handles several SDK response shapes
  (`.save(path)`, bytes attrs, `.url`) since the SDK surface is evolving.
- Generation is CPU-cheap but wall-clock-long; the backend runs each job on
  a dedicated thread so `POST /generate-videos` returns immediately.
