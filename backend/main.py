from __future__ import annotations

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

load_dotenv()

from routes.videos import router as videos_router  # noqa: E402
from utils.files import ensure_dirs  # noqa: E402

app = FastAPI(title="Grok Batch Video Generator", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
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
