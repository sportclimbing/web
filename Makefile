PLAYWRIGHT_IMAGE ?= mcr.microsoft.com/playwright:v1.54.1-noble
DOCKER_RUN = docker run --rm --init --ipc=host -u "$(shell id -u):$(shell id -g)" -e HOME=/tmp -e npm_config_cache=/tmp/.npm -v "$(PWD):/work" -w /work

.DEFAULT_GOAL := build
.PHONY: test test-local test-docker serve build

build:
	npm run build:js
	npm run build:astro -- --mode production

test:
	@if docker info >/dev/null 2>&1; then \
		$(MAKE) test-docker; \
	elif command -v node >/dev/null 2>&1; then \
		$(MAKE) test-local; \
	else \
		echo "Neither a running Docker daemon nor Node.js is available."; \
		exit 1; \
	fi

test-local:
	npm install --no-package-lock
	npx playwright test

test-docker:
	$(DOCKER_RUN) $(PLAYWRIGHT_IMAGE) sh -lc "npm install --no-package-lock && npx playwright test"

serve:
	@if [ ! -f dist/index.html ]; then \
		echo "dist/index.html missing. Run 'npm run build' first."; \
		exit 1; \
	fi

	caddy file-server --listen :8000 --root dist
