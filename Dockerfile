# syntax = docker/dockerfile:1

ARG BUN_VERSION=1.1.38
FROM oven/bun:${BUN_VERSION}-slim AS base

WORKDIR /app

ENV NODE_ENV="production"
ENV PORT=8080  # Render requires specific port

# Install system dependencies
RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y build-essential pkg-config python-is-python3

# Copy project files
COPY package.json bun.lockb* ./
COPY ./apps/boundless-ws-client ./apps/boundless-ws-client
COPY ./packages/shared ./packages/shared

# Install dependencies
RUN bun install --ci

WORKDIR /app/apps/boundless-ws-client

# Expose the port Render uses
EXPOSE 8080

# Start command
CMD [ "bun", "run", "start" ]
