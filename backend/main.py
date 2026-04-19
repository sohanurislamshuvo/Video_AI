from __future__ import annotations

import os

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

load_dotenv()

from routes.videos import router as videos_router  # noqa: E402
from utils.files import ensure_dirs  # noqa: E402

app = FastAPI(title="Grok Batch Video Generator", version="1.0.0")

# Read allowed origins from env — comma-separated list.
# Example: ALLOWED_ORIGINS=https://your-app.vercel.app,http://localhost:3000
_raw_origins = os.environ.get(
    "ALLOWED_ORIGINS",
    "http://localhost:3000,http://127.0.0.1:3000",
)
ALLOWED_ORIGINS = [o.strip() for o in _raw_origins.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def _startup() -> None:
    ensure_dirs()


@app.get("/health")
def health() -> dict:
    return {"ok": True}


app.include_router(videos_router)
