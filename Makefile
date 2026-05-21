.PHONY: dev backend frontend build sync-apps install

# Local dev — runs backend + frontend dev server in parallel
dev:
	@make -j2 backend frontend

backend:
	cd backend && ../.venv/bin/uvicorn main:app --reload --host 0.0.0.0 --port 8002

frontend:
	cd frontend && npx vite --host

# Build frontend and copy into backend/static (production-like local test)
build: sync-apps
	cd frontend && npx vite build
	rm -rf backend/static
	cp -r frontend/dist backend/static

# Copy latest ScaleSnap files into the frontend public dir
sync-apps:
	cp ../ImageRef/index.html ../ImageRef/app.js ../ImageRef/style.css frontend/public/apps/scalesnap/

install:
	.venv/bin/pip install -r backend/requirements.txt
	cd frontend && npm install
