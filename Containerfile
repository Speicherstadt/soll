# Soll as a container image (BAULISTE.md S-905, docs/installation.md). Two stages: Bun builds the web
# app and compiles the server into one binary (migrations embedded); the runtime image holds only
# that binary and the static build, no Bun, no sources, no node_modules.
#
#   docker build -f Containerfile -t soll .
#
# The Bun version is the one in package.json (packageManager); the release builds amd64 and arm64
# each on its own runner (.github/workflows/release.yml), so the compile step is never emulated.
FROM docker.io/oven/bun:1.4.5-slim AS build
WORKDIR /src
# Manifests first: the installed packages stay cached while only the sources change
COPY package.json bun.lock ./
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/
COPY packages/arbeitszeit/package.json packages/arbeitszeit/
COPY packages/export/package.json packages/export/
COPY packages/import/package.json packages/import/
COPY packages/ui/package.json packages/ui/
RUN bun install --frozen-lockfile
COPY . .
RUN bun run --cwd apps/web build \
 && bun run --cwd apps/server build \
 && mkdir -p /leer

# Runtime: Debian's glibc and libstdc++ for the compiled Bun binary, CA certificates for SMTPS and
# Web Push, tzdata; no shell, no package manager. The tag follows Debian's security updates, so every
# release build picks them up.
FROM gcr.io/distroless/cc-debian12:nonroot
COPY --from=build /src/apps/server/dist/soll /usr/local/bin/soll
COPY --from=build /src/apps/web/dist /app/web
# The data directory belongs to the unprivileged user (65532, "nonroot"), also as a fresh volume
COPY --from=build --chown=65532:65532 /leer /data
# No secret here: SOLL_SECRET_KEY, SOLL_URL and SMTP come from the environment at run time
ENV SOLL_HOST=0.0.0.0 \
    SOLL_PORT=8200 \
    SOLL_DATA_DIR=/data \
    SOLL_WEB_DIR=/app/web
# Late, so another version rebuilds only these layers; the release passes the tag
ARG SOLL_VERSION=0.0.0
ARG SOLL_COMMIT=""
ENV SOLL_VERSION=$SOLL_VERSION
LABEL org.opencontainers.image.title="Soll" \
      org.opencontainers.image.description="Zeiterfassung und Dienstplan für kleine Betriebe" \
      org.opencontainers.image.source="https://github.com/Speicherstadt/soll" \
      org.opencontainers.image.licenses="AGPL-3.0-only" \
      org.opencontainers.image.version="$SOLL_VERSION" \
      org.opencontainers.image.revision="$SOLL_COMMIT"
USER nonroot
VOLUME /data
EXPOSE 8200
# Without curl in the image: the binary asks its own /health (src/cli.ts)
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 CMD ["soll", "health"]
# `docker run … soll backup` and `docker exec <container> soll backup` reach the same commands
ENTRYPOINT ["soll"]
