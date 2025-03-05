# syntax = docker/dockerfile:1

# Adjust BUN_VERSION as desired
ARG BUN_VERSION=1.1.38
# Adjust NODE_VERSION as desired
ARG NODE_VERSION=20
FROM oven/bun:${BUN_VERSION}-slim AS base

LABEL fly_launch_runtime="Bun"

# Set the working directory to root
WORKDIR /

# Set production environment
ENV NODE_ENV="production"

# Install packages needed to build node modules
RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y build-essential pkg-config python-is-python3

# Install node modules
COPY package.json ./
COPY ./apps/boundless-ws-client ./apps/boundless-ws-client
COPY ./packages/shared ./packages/shared

RUN bun install --ci

# Set the working directory for the final stage
WORKDIR /apps/boundless-ws-client

# Start the server
CMD [ "bun", "run", "start" ]
