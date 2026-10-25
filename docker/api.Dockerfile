# syntax=docker/dockerfile:1.18
ARG RUST_BUILDER=rust:1.97-slim-bookworm@sha256:2775a09d208ff0d7c1f50490c45b62db929e87ba1dcbc3f2132ac71a704bcdd3
ARG TESSERIX_RUNTIME=ghcr.io/tesserix/base-debian-runtime@sha256:74ac2fca91acb02b50b946a770abe81e03cbae561cb1cba0db4dce2ca4c1c226
FROM ${RUST_BUILDER} AS build
WORKDIR /src
COPY Cargo.toml Cargo.lock ./
COPY api ./api
COPY shared/app-links.json ./shared/app-links.json
COPY assets/civiclens-icon.png ./assets/civiclens-icon.png
RUN --mount=type=cache,target=/usr/local/cargo/registry \
    --mount=type=cache,target=/src/target \
    cargo build --locked --release -p civiclens-api \
    && mkdir -p /out && cp target/release/civiclens-api /out/civiclens-api
FROM ${TESSERIX_RUNTIME}
WORKDIR /app
COPY --from=build --chown=10001:10001 /out/civiclens-api /app/civiclens-api
COPY --chown=10001:10001 api/data /app/api/data
COPY --chown=10001:10001 api/migrations /app/api/migrations
USER 10001:10001
ENV CIVICLENS_BIND=0.0.0.0:8080
EXPOSE 8080
ENTRYPOINT ["/usr/bin/tini", "--", "/app/civiclens-api"]
