FROM node:22-bookworm-slim@sha256:c3de60bf2f9dd0ac6370e6117950ff62d6e339527e7472301c9c78a017978392

ENV PYTHON=/opt/guanmo-venv/bin/python3 \
    PYTHONUTF8=1 \
    PYTHONIOENCODING=utf-8 \
    PLAYWRIGHT_BROWSERS_PATH=/ms-playwright \
    STUDIO_GL=software \
    npm_config_cache=/tmp/guanmo-npm-cache

WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends python3-venv ffmpeg ca-certificates \
    && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json requirements.txt ./
ARG PLAYWRIGHT_CHROMIUM_DOWNLOAD_HOST
RUN npm ci --registry=https://registry.npmjs.org \
    && python3 -m venv /opt/guanmo-venv \
    && /opt/guanmo-venv/bin/python3 -m pip install --no-cache-dir -r requirements.txt \
    && node node_modules/playwright/cli.js install --with-deps --no-shell chromium \
    && rm -rf /var/lib/apt/lists/*
COPY scripts/ scripts/
COPY templates/ templates/
COPY assets/ assets/
COPY examples/ examples/
COPY web/ web/
COPY docs/ docs/
COPY tests/ tests/
COPY LICENSE THIRD_PARTY_NOTICES.md README.md README.en.md AGENTS.md CONTRIBUTING.md SECURITY.md CODE_OF_CONDUCT.md CHANGELOG.md ./
RUN chmod -R a+rX /app \
    && mkdir -p build renders .local && chmod 1777 build renders .local
USER node
CMD ["npm", "run", "doctor", "--", "--render", "--probe"]
