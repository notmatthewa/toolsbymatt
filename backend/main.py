import asyncio
import json
import os
import re
import tempfile
from contextlib import asynccontextmanager
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).parent.parent / ".env")

import httpx
import yt_dlp
from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from starlette.middleware.base import BaseHTTPMiddleware

STATIC_DIR = Path(__file__).parent / "static"


class AppEntry(BaseModel):
    id: str
    name: str
    description: str
    url: str
    icon: str
    tags: list[str]


class AppsResponse(BaseModel):
    apps: list[AppEntry]


@asynccontextmanager
async def lifespan(app: FastAPI):
    config_path = Path(__file__).parent / "apps.json"
    with open(config_path) as f:
        data = json.load(f)
    app.state.apps = [AppEntry(**entry) for entry in data["apps"]]
    yield


app = FastAPI(title="Tools by Matt", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class NoCacheStaticMiddleware(BaseHTTPMiddleware):
    """Short cache for non-hashed static files so Cloudflare doesn't serve stale content."""
    async def dispatch(self, request, call_next):
        response = await call_next(request)
        path = request.url.path
        # Vite-hashed assets (e.g. /assets/index-Dy88f-5y.js) can cache forever
        if path.startswith("/assets/"):
            response.headers["cache-control"] = "public, max-age=31536000, immutable"
        # Sub-app static assets — short cache, must revalidate
        elif path.startswith("/apps/"):
            response.headers["cache-control"] = "public, max-age=60, must-revalidate"
        return response


app.add_middleware(NoCacheStaticMiddleware)


# ---------- API ----------

@app.get("/api/apps", response_model=AppsResponse)
async def get_apps():
    return AppsResponse(apps=app.state.apps)


# Bidirectional synonym groups — any word in a group matches any other
_SYNONYM_GROUPS = [
    {"food", "meal", "restaurant", "dining", "eat", "lunch", "dinner"},
    {"photo", "picture", "image", "camera", "pic"},
    {"measure", "ruler", "scale", "size", "dimension", "length", "distance"},
    {"random", "spin", "wheel", "pick", "choose", "roulette"},
    {"location", "map", "place", "nearby", "local", "drive"},
    {"perspective", "3d", "angle", "depth", "height"},
    {"youtube", "video", "audio", "music", "mp3", "mp4", "download", "dj", "mixer", "song"},
]

_SYNONYMS: dict[str, set[str]] = {}
for group in _SYNONYM_GROUPS:
    for word in group:
        _SYNONYMS.setdefault(word, set()).update(group)


def _expand_query(query: str) -> set[str]:
    """Return the query plus any synonyms for words in it."""
    terms = {query}
    for word in query.split():
        terms.update(_SYNONYMS.get(word, set()))
    return terms


@app.get("/api/apps/search", response_model=AppsResponse)
async def search_apps(q: str = Query("", min_length=0)):
    if not q:
        return AppsResponse(apps=app.state.apps)
    terms = _expand_query(q.lower())
    results = [
        a for a in app.state.apps
        if any(
            t in a.name.lower()
            or t in a.description.lower()
            or any(t in tag for tag in a.tags)
            for t in terms
        )
    ]
    return AppsResponse(apps=results)


# ---------- Isochrone / Geocode Proxy (OpenRouteService) ----------

ORS_KEY = os.environ.get("ORS_API_KEY", "")


@app.get("/api/isochrone")
async def isochrone(lat: float, lon: float, minutes: int = Query(ge=1, le=60)):
    if not ORS_KEY:
        raise HTTPException(503, "ORS_API_KEY not configured")
    async with httpx.AsyncClient(timeout=20) as client:
        resp = await client.post(
            "https://api.openrouteservice.org/v2/isochrones/driving-car",
            headers={"Authorization": ORS_KEY},
            json={"locations": [[lon, lat]], "range": [minutes * 60], "range_type": "time"},
        )
    if resp.status_code != 200:
        raise HTTPException(resp.status_code, resp.text)
    return resp.json()


@app.get("/api/geocode")
async def geocode(q: str = Query(min_length=1)):
    if not ORS_KEY:
        raise HTTPException(503, "ORS_API_KEY not configured")
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(
            "https://api.openrouteservice.org/geocode/search",
            headers={"Authorization": ORS_KEY},
            params={"text": q, "size": 5},
        )
    if resp.status_code != 200:
        raise HTTPException(resp.status_code, resp.text)
    return resp.json()


# ---------- YouTube Downloader ----------

_YT_URL_RE = re.compile(r"(youtube\.com|youtu\.be)")


@app.get("/api/yt/info")
async def yt_info(url: str = Query(...)):
    if not _YT_URL_RE.search(url):
        raise HTTPException(400, "Only YouTube URLs are supported")

    opts = {"quiet": True, "no_warnings": True, "skip_download": True}

    def extract():
        with yt_dlp.YoutubeDL(opts) as ydl:
            return ydl.extract_info(url, download=False)

    try:
        info = await asyncio.to_thread(extract)
    except yt_dlp.utils.DownloadError as e:
        raise HTTPException(400, str(e))

    return {
        "title": info.get("title"),
        "thumbnail": info.get("thumbnail"),
        "duration": info.get("duration"),
        "id": info.get("id"),
    }


@app.get("/api/yt/download")
async def yt_download(
    url: str = Query(...),
    format: str = Query("mp3", pattern="^(mp3|mp4)$"),
    quality: int = Query(1080, ge=360, le=2160),
):
    if not _YT_URL_RE.search(url):
        raise HTTPException(400, "Only YouTube URLs are supported")

    tmp_dir = tempfile.mkdtemp()
    out_template = os.path.join(tmp_dir, "%(title)s.%(ext)s")

    if format == "mp3":
        opts = {
            "quiet": True,
            "no_warnings": True,
            "format": "bestaudio/best",
            "outtmpl": out_template,
            "postprocessors": [
                {"key": "FFmpegExtractAudio", "preferredcodec": "mp3", "preferredquality": "192"}
            ],
        }
    else:
        opts = {
            "quiet": True,
            "no_warnings": True,
            "format": f"bestvideo[height<={quality}]+bestaudio/best[height<={quality}]",
            "outtmpl": out_template,
            "merge_output_format": "mp4",
        }

    def download():
        with yt_dlp.YoutubeDL(opts) as ydl:
            ydl.download([url])

    try:
        await asyncio.to_thread(download)
    except yt_dlp.utils.DownloadError as e:
        raise HTTPException(400, str(e))

    # Find the output file
    files = list(Path(tmp_dir).iterdir())
    if not files:
        raise HTTPException(500, "Download produced no output")
    out_file = files[0]

    def stream():
        try:
            with open(out_file, "rb") as f:
                while chunk := f.read(65536):
                    yield chunk
        finally:
            import shutil
            shutil.rmtree(tmp_dir, ignore_errors=True)

    media_type = "audio/mpeg" if format == "mp3" else "video/mp4"
    filename = out_file.name
    return StreamingResponse(
        stream(),
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ---------- Static files (production: built frontend served by FastAPI) ----------

# React build assets (/assets/*)
assets_dir = STATIC_DIR / "assets"
if assets_dir.is_dir():
    app.mount("/assets", StaticFiles(directory=str(assets_dir)), name="assets")

# SPA fallback — serve index.html for any non-API, non-static path
index_html = STATIC_DIR / "index.html"


@app.get("/{path:path}")
async def spa_fallback(request: Request, path: str):
    # Try to serve the exact file first (e.g. favicon.ico, app JS/CSS assets)
    file_path = STATIC_DIR / path
    if path and file_path.is_file():
        return FileResponse(file_path)
    # Otherwise serve the React SPA (client-side routing handles /apps/*)
    if index_html.is_file():
        return FileResponse(index_html)
    return {"detail": "Not found — run `make build` to generate frontend"}
