import { OrderStreamClient } from "./client";

import "shared/utils/big-int-json";

if (!process.env.WS_WALLET_PRIVATE_KEY) {
  throw new Error("WS_WALLET_PRIVATE_KEY env variable is not set");
}

async function main() {
  const client = new OrderStreamClient(process.env.WS_WALLET_PRIVATE_KEY!);

  const handleShutdown = () => {
    console.info("Received shutdown signal");
    client.disconnect();
    process.exit(0);
  };

  // Handle process termination
  process.on("SIGINT", handleShutdown);
  process.on("SIGTERM", handleShutdown);

  // Handle uncaught errors
  process.on("uncaughtException", (error) => {
    console.error("Uncaught exception:", error);
    client.disconnect();
    process.exit(1);
  });

  try {
    await client.connect();
    console.info("WebSocket client running. Press Ctrl+C to exit.");
  } catch (error) {
    console.error("Failed to start WebSocket client:", error);
    process.exit(1);
  }
}

main();
