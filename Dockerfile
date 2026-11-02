ARG BUILD_DIR=/build

# Build Container
FROM --platform=$BUILDPLATFORM node:26-alpine@sha256:c6ad9e9c1d80f6eb607c26b4b0a132ff7a2344fad1c78ea3baa2a7d4c8de6d94 AS build

ARG BUILD_DIR

RUN mkdir ${BUILD_DIR}
WORKDIR ${BUILD_DIR}

COPY .htmlnanorc \
    package.json \
    package-lock.json \
    postcss.config.js \
    tailwind.config.js \
    vite.config.js \
    ./

RUN npm ci

COPY client ./client
RUN npm run build

# Runtime Container
FROM python:3.13-slim-trixie@sha256:2d44738ebf4ce5f63b9d9ea871e9c7cfdc0426f7b0c97cac915fd88ded1d86bb
COPY --from=ghcr.io/astral-sh/uv:0.13.6@sha256:af22a52f5eafef3d78e551599d405c02df61919d18028f0cea8eda93bc9986d0 /uv /uvx /bin/

ARG BUILD_DIR

ENV PUID=1000
ENV PGID=1000
ENV EXEC_TOOL=gosu
ENV FLATNOTES_HOST=0.0.0.0
ENV FLATNOTES_PORT=8080

ENV APP_PATH=/app
ENV FLATNOTES_PATH=/data

RUN mkdir -p ${APP_PATH}
RUN mkdir -p ${FLATNOTES_PATH}

RUN apt update && apt install -y \
    curl \
    gosu \
    && rm -rf /var/lib/apt/lists/*

WORKDIR ${APP_PATH}

COPY LICENSE pyproject.toml .python-version uv.lock ./

ENV UV_NO_MANAGED_PYTHON=1
ENV UV_PROJECT_ENVIRONMENT=/usr/local
RUN uv sync --locked --compile-bytecode --no-dev

COPY server ./server
COPY --from=build --chmod=755 ${BUILD_DIR}/client/dist ./client/dist
RUN chown 1000:1000 ./client/dist/index.html

COPY entrypoint.sh healthcheck.sh /
RUN sed -i 's/\r$//' /entrypoint.sh /healthcheck.sh \
    && chmod +x /entrypoint.sh /healthcheck.sh

VOLUME /data
EXPOSE ${FLATNOTES_PORT}/tcp
HEALTHCHECK --interval=60s --timeout=10s CMD /healthcheck.sh

ENTRYPOINT [ "/entrypoint.sh" ]
