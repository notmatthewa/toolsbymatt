# ---- Stage 1: Build React frontend ----
FROM node:22-slim AS frontend
WORKDIR /build
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
# Strip HEIC support for production (not widely supported outside iOS Safari)
RUN sed -i 's/accept="image\/\*,\.heic,\.heif"/accept="image\/jpeg,image\/png,image\/webp,image\/gif"/' public/apps/scalesnap/index.html \
 && sed -i 's/heic|heif|//' public/apps/scalesnap/app.js
RUN npx vite build

# ---- Stage 2: Production FastAPI server ----
FROM python:3.12-slim
WORKDIR /app

COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ ./

# Copy built frontend into backend/static
COPY --from=frontend /build/dist ./static

EXPOSE 8080
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080"]
