FROM rust:1.94-slim AS builder
# Build from the repository root so the server can include the shared prompt.
WORKDIR /app/server
COPY server/Cargo.toml server/Cargo.lock ./
COPY adk-rust ../adk-rust
COPY server/src ./src
COPY server/migrations ./migrations
COPY src-tauri/prompts/companion.md ../src-tauri/prompts/companion.md
RUN cargo build --release

FROM debian:bookworm-slim AS runtime
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates curl \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=builder /app/server/target/release/drink-server /usr/local/bin/drink-server
ENV HOST=0.0.0.0 PORT=8080
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -fsS http://127.0.0.1:8080/ready || exit 1
USER nobody
ENTRYPOINT ["drink-server"]
