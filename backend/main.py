import asyncio
import io
import json
import os
import re
import tempfile
import zipfile
from contextlib import asynccontextmanager
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).parent.parent / ".env")

import httpx
import yt_dlp
from fastapi import FastAPI, File, HTTPException, Query, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, Response, StreamingResponse
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
    {"file", "convert", "powerpoint", "pptx", "pdf", "image", "extract", "slides", "presentation"},
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


# ---------- File Converter ----------

def _extract_images_pptx(data: bytes) -> list[tuple[str, bytes]]:
    """Extract all images from a PowerPoint file."""
    from pptx import Presentation
    from pptx.enum.shapes import MSO_SHAPE_TYPE

    prs = Presentation(io.BytesIO(data))
    images: list[tuple[str, bytes]] = []
    idx = 0
    for slide_num, slide in enumerate(prs.slides, 1):
        for shape in slide.shapes:
            if shape.shape_type == MSO_SHAPE_TYPE.PICTURE:
                img = shape.image
                ext = img.content_type.split("/")[-1].replace("jpeg", "jpg")
                idx += 1
                images.append((f"slide{slide_num:02d}_{idx:03d}.{ext}", img.blob))
            elif shape.shape_type == MSO_SHAPE_TYPE.GROUP:
                for s in shape.shapes:
                    if hasattr(s, "image"):
                        img = s.image
                        ext = img.content_type.split("/")[-1].replace("jpeg", "jpg")
                        idx += 1
                        images.append((f"slide{slide_num:02d}_{idx:03d}.{ext}", img.blob))
    return images


def _extract_images_pdf(data: bytes) -> list[tuple[str, bytes]]:
    """Extract images from a PDF, or render pages as images."""
    import fitz  # pymupdf

    doc = fitz.open(stream=data, filetype="pdf")
    images: list[tuple[str, bytes]] = []
    for page_num, page in enumerate(doc, 1):
        # Render page as PNG (ensures we always get output even if no embedded images)
        pix = page.get_pixmap(dpi=200)
        images.append((f"page{page_num:03d}.png", pix.tobytes("png")))
    return images


def _convert_image(data: bytes, target_format: str) -> tuple[str, bytes]:
    """Convert an image to the target format."""
    from PIL import Image

    img = Image.open(io.BytesIO(data))
    if img.mode == "RGBA" and target_format.lower() in ("jpg", "jpeg"):
        img = img.convert("RGB")
    buf = io.BytesIO()
    fmt_map = {"jpg": "JPEG", "jpeg": "JPEG", "png": "PNG", "webp": "WEBP", "gif": "GIF"}
    img.save(buf, format=fmt_map.get(target_format.lower(), "PNG"))
    return f"converted.{target_format}", buf.getvalue()


@app.post("/api/convert")
async def convert_file(
    file: UploadFile = File(...),
    target: str = Query("images", pattern="^(images|png|jpg|pdf)$"),
):
    data = await file.read()
    filename = file.filename or "file"
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""

    results: list[tuple[str, bytes]] = []

    if ext in ("pptx", "ppt"):
        results = await asyncio.to_thread(_extract_images_pptx, data)
    elif ext == "pdf":
        results = await asyncio.to_thread(_extract_images_pdf, data)
    elif ext in ("png", "jpg", "jpeg", "webp", "gif", "bmp", "tiff", "heic"):
        if target in ("png", "jpg"):
            name, converted = await asyncio.to_thread(_convert_image, data, target)
            results = [(name, converted)]
        else:
            results = [(filename, data)]
    else:
        raise HTTPException(400, f"Unsupported file type: .{ext}")

    if not results:
        raise HTTPException(400, "No content could be extracted")

    # Single file: return directly
    if len(results) == 1:
        name, content = results[0]
        ext_out = name.rsplit(".", 1)[-1]
        media_types = {"png": "image/png", "jpg": "image/jpeg", "jpeg": "image/jpeg",
                       "gif": "image/gif", "webp": "image/webp", "pdf": "application/pdf"}
        return Response(
            content,
            media_type=media_types.get(ext_out, "application/octet-stream"),
            headers={"Content-Disposition": f'attachment; filename="{name}"'},
        )

    # Multiple files: zip them
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for name, content in results:
            zf.writestr(name, content)
    buf.seek(0)
    stem = filename.rsplit(".", 1)[0]
    return Response(
        buf.getvalue(),
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{stem}_images.zip"'},
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
