.PHONY: dev build deploy sync-apps install

# Local dev (frontend only — no backend needed)
dev:
	cd frontend && npx vite --host

# Build for production
build: sync-apps
	cd frontend && npx vite build

# Copy latest ScaleSnap files into public before build
sync-apps:
	cp ../ImageRef/index.html ../ImageRef/app.js ../ImageRef/style.css frontend/public/apps/scalesnap/

# Deploy to Cloudflare Pages
deploy: build
	cd frontend && npx wrangler pages deploy dist --project-name=toolsbymatt

install:
	cd frontend && npm install
