import json
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
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


@app.get("/api/apps/search", response_model=AppsResponse)
async def search_apps(q: str = Query("", min_length=0)):
    if not q:
        return AppsResponse(apps=app.state.apps)
    query = q.lower()
    results = [
        a for a in app.state.apps
        if query in a.name.lower()
        or query in a.description.lower()
        or any(query in tag for tag in a.tags)
    ]
    return AppsResponse(apps=results)


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
