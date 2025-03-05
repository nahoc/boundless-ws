# Boundless WebSocket Client

A WebSocket client service that connects to the Boundless order stream and processes incoming orders into a PostgreSQL database.

## Overview

This service:

* Connects to the Boundless order stream websocket endpoint
* Authenticates using Ethereum signatures (via siwe)
* Processes incoming order data
* Stores orders in a PostgreSQL database
* Handles reconnection with exponential backoff

## Prerequisites

* [Bun](https://bun.sh/) runtime
* [Fly.io](https://fly.io/) CLI
* PostgreSQL database
* Ethereum private key for authentication
* Environment variables configured

## Environment Variables

Create a `.env` file with:

```
WS_WALLET_PRIVATE_KEY="your-ethereum-private-key"
POSTGRES_URL="your-postgres-connection-string"
```

## Installation & Development

Install dependencies:

```bash
bun install
```

Start the client locally:

```bash
bun start
```

The client will:

1. Connect to the WebSocket server
2. Listen for incoming orders
3. Process and store orders in the database
4. Automatically reconnect on disconnection (up to 3 attempts)

The main components are:

* `client.ts` - WebSocket client implementation
* `index.ts` - Service entry point

## Docker & Deploys

Install fly.io CLI:

```bash
brew install flyctl
```

A Dockerfile is included. In order to deploy the service, run:

```bash
fly deploy
```

And go to https://fly.io/apps/ws-client.
