import json
import os
from contextlib import asynccontextmanager
from pathlib import Path

import httpx
from fastapi import FastAPI, HTTPException, Query, Request
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
