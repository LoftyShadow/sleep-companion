FROM rust:1.85-bookworm AS builder

WORKDIR /app
COPY . .
RUN cargo build --release -p sleep-companion-backend

FROM debian:bookworm-slim

WORKDIR /app
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/target/release/sleep-companion-backend /usr/local/bin/sleep-companion-backend
COPY backend/config ./backend/config

ENV APP_ENV=production
EXPOSE 3817

CMD ["sleep-companion-backend"]
