import "dotenv/config";

import { OrderStreamClient } from "./client.js";

import "shared/utils/big-int-json.js";

if (!process.env.WS_WALLET_PRIVATE_KEY) {
	throw new Error("WS_WALLET_PRIVATE_KEY env variable is not set");
}

async function main() {
	const client = new OrderStreamClient(process.env.WS_WALLET_PRIVATE_KEY);

	try {
		await client.connect();
		console.info("WebSocket client running. Press Ctrl+C to exit.");
	} catch (error) {
		console.error("Failed to start WebSocket client:", error);
		process.exit(1);
	}
}

main();
