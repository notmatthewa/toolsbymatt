.PHONY: dev fe be build install

dev:
	@make -j2 be fe

fe:
	rm -rf frontend/node_modules/.vite
	cd frontend && npx vite --host

be:
	cd backend && ../.venv/bin/uvicorn main:app --reload --host 0.0.0.0 --port 8002

build:
	cd frontend && npx vite build
	rm -rf backend/static
	cp -r frontend/dist backend/static

install:
	.venv/bin/pip install -r backend/requirements.txt
	cd frontend && npm install
