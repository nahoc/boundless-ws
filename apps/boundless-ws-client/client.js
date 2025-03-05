import { throttle } from "es-toolkit";
import { Wallet, ethers } from "ethers";
import postgres from "postgres";
import { EIP712_TYPES } from "shared/const/eip712-types.js";
import { strip0xPrefix } from "shared/utils/strip-0x-prefix.js";
import { hashTypedData } from "viem";
import WebSocket from "ws";

// TODO this is hard coded, but will be based on network config
const PROOF_MARKET_CONTRACT_ADDRESS =
	"0x01e4130C977b39aaa28A744b8D3dEB23a5297654";

if (!process.env.POSTGRES_URL) {
	throw new Error("POSTGRES_URL env variable is not set");
}

const sql = postgres(process.env.POSTGRES_URL);

function getCustomerAddr(id) {
	// Shift right by 32 bits to remove the 32-bit index
	const addrBigInt = BigInt(id) >> 32n;

	return `0x${addrBigInt.toString(16).padStart(40, "0").toLowerCase()}`;
}

const throttledRevalidate = throttle(() => {
	fetch("https://explorer.beboundless.xyz/api/orders/revalidate");
}, 10_000);

export class OrderStreamClient {
	ws = null;
	address;
	wallet;
	baseUrl = process.env.ORDER_STREAM_URL
		? process.env.ORDER_STREAM_URL.replace(/\/+$/, "")
		: "https://order-stream.beboundless.xyz";

	BATCH_SIZE = 10;
	MAX_QUEUE_SIZE = 1000;
	isProcessing = false;
	orderQueue = [];

	constructor(privateKey) {
		if (!privateKey) {
			throw new Error("Private key is required");
		}

		const cleanKey = strip0xPrefix(privateKey);

		if (!/^[0-9a-fA-F]{64}$/.test(cleanKey)) {
			throw new Error(
				"Invalid private key format. Expected 64-character hex string",
			);
		}

		this.wallet = new Wallet(cleanKey);
		this.address = this.wallet.address;
	}

	async processNextBatch() {
		if (this.isProcessing || this.orderQueue.length === 0) {
			return;
		}

		if (this.orderQueue.length >= this.MAX_QUEUE_SIZE) {
			console.warn(
				`Order queue size (${this.orderQueue.length}) has reached limit. Dropping older orders.`,
			);
			this.orderQueue = this.orderQueue.slice(-this.MAX_QUEUE_SIZE);
		}

		this.isProcessing = true;
		try {
			const batch = this.orderQueue.splice(0, this.BATCH_SIZE);

			if (batch.length === 0) {
				return;
			}

			const values = batch
				.map((orderData) => {
					if (!orderData || !orderData.order) {
						console.error("Invalid order data received");
						return null;
					}

					const { request, _signature } = orderData.order;

					if (!request || !request.id) {
						console.error("Order has no request or request.id");
						return null;
					}

					const orderId = request.id;
					const customerAddr = getCustomerAddr(request.id);

					// @TODO: verify signature

					// Create a clean message object that matches the EIP712 types exactly
					const typedMessage = {
						id: BigInt(request.id),
						requirements: {
							imageId: request.requirements.imageId,
							predicate: {
								predicateType: Number(
									request.requirements.predicate.predicateType === "PrefixMatch"
										? 0
										: 1,
								),
								data: request.requirements.predicate.data,
							},
						},
						input: {
							inputType: Number(request.input.inputType === "Inline" ? 0 : 1),
							data: request.input.data,
						},
						offer: {
							minPrice: BigInt(request.offer.minPrice),
							maxPrice: BigInt(request.offer.maxPrice),
							biddingStart: BigInt(request.offer.biddingStart),
							rampUpPeriod: Number(request.offer.rampUpPeriod),
							timeout: Number(request.offer.timeout),
							lockStake: BigInt(request.offer.lockStake),
						},
						imageUrl: request.imageUrl,
					};

					const requestDigest = strip0xPrefix(
						hashTypedData({
							domain: {
								name: "IBoundlessMarket",
								version: "1",
								// TODO this is hard coded, but will be based on network config
								chainId: 11155111,
								verifyingContract: PROOF_MARKET_CONTRACT_ADDRESS,
							},
							types: EIP712_TYPES,
							primaryType: "ProofRequest",
							message: typedMessage,
						}),
					);

					const order = {
						order_id: orderId,
						// TODO this is hard coded, but will be based on network config
						chain: "sepolia",
						customer_addr: customerAddr,
						state: "SUBMITTED",
						min_price: BigInt(request.offer.minPrice),
						max_price: BigInt(request.offer.maxPrice),
						bidding_start: BigInt(request.offer.biddingStart),
						timeout: BigInt(request.offer.timeout),
						lock_stake: BigInt(request.offer.lockStake),
						ramp_up_period: BigInt(request.offer.rampUpPeriod),
						img_id: request.requirements.imageId,
						img_url: request.imageUrl,
						input_type: request.input.inputType === "Inline" ? 0n : 1n,
						input_data: request.input.data,
						predicate_type:
							request.requirements.predicate.predicateType === "PrefixMatch"
								? 0n
								: 1n,
						predicate_data: request.requirements.predicate.data,
						timestamp: orderData.created_at,
						created_at: orderData.created_at,
						request_digest: requestDigest,
					};

					return [
						order.order_id,
						order.chain,
						order.customer_addr,
						order.state,
						String(order.min_price),
						String(order.max_price),
						String(order.bidding_start),
						String(order.timeout),
						String(order.lock_stake),
						String(order.ramp_up_period),
						order.img_id,
						order.img_url,
						String(order.input_type),
						order.input_data,
						String(order.predicate_type),
						order.predicate_data,
						order.timestamp,
						order.created_at,
						order.request_digest,
						"OFFCHAIN", // source
					];
				})
				.filter((v) => v !== null);

			if (values.length === 0) {
				console.warn("No valid orders to process in batch");
				return;
			}

			await sql`
        INSERT INTO orders (
          order_id, chain, customer_addr, state, min_price, max_price,
          bidding_start, timeout, lock_stake, ramp_up_period,
          img_id, img_url, input_type, input_data,
          predicate_type, predicate_data, timestamp,
          created_at, request_digest, source
        )
        VALUES ${sql(values)}
        ON CONFLICT (order_id) DO UPDATE SET
          customer_addr = EXCLUDED.customer_addr,
          state = EXCLUDED.state,
          min_price = EXCLUDED.min_price,
          max_price = EXCLUDED.max_price,
          bidding_start = EXCLUDED.bidding_start,
          timeout = EXCLUDED.timeout,
          lock_stake = EXCLUDED.lock_stake,
          ramp_up_period = EXCLUDED.ramp_up_period,
          img_id = EXCLUDED.img_id,
          img_url = EXCLUDED.img_url,
          input_type = EXCLUDED.input_type,
          input_data = EXCLUDED.input_data,
          predicate_type = EXCLUDED.predicate_type,
          predicate_data = EXCLUDED.predicate_data,
          timestamp = EXCLUDED.timestamp,
          created_at = EXCLUDED.created_at,
          request_digest = EXCLUDED.request_digest,
          source = EXCLUDED.source,
          chain = EXCLUDED.chain
      `;

			console.info(
				`Processed batch: ${batch.length} orders. Queue: ${this.orderQueue.length}. OrderIds: ${batch
					.map((order) => order.order.request.id)
					.join(", ")}`,
			);

			throttledRevalidate();

			// If there are more orders, process the next batch
			if (this.orderQueue.length > 0) {
				setTimeout(() => this.processNextBatch(), 0);
			}
		} catch (error) {
			console.error("Batch processing failed:", error);
		} finally {
			this.isProcessing = false;
		}
	}

	async connect() {
		try {
			console.info("Connecting to WebSocket server...");

			await this.establishConnection();

			// Start the processing loop only after successful connection
			this.processNextBatch();

			console.info("WebSocket connection established");
			return this.ws;
		} catch (error) {
			console.error("Failed to connect to WebSocket server:", error);
			this.ws = null;

			throw error;
		}
	}

	async establishConnection() {
		console.log("1");
		const nonceResponse = await fetch(
			`${this.baseUrl}/api/nonce/${this.address}`,
		);
		console.log("2");
		const { nonce } = await nonceResponse.json();
		console.log("3");
		const authority = new URL(this.baseUrl).host;
		const messageString = [
			`${authority} wants you to sign in with your Ethereum account:`,
			this.address,
			"",
			"Boundless Order Stream",
			"",
			`URI: ${this.baseUrl}`,
			"Version: 1",
			"Chain ID: 1",
			`Nonce: ${nonce}`,
			`Issued At: ${new Date().toISOString()}`,
		].join("\n");

		const signature = await this.wallet.signMessage(messageString);
		const sig = ethers.Signature.from(signature);
		console.log("4");
		const authMessage = {
			message: messageString,
			signature: {
				r: sig.r,
				s: sig.s,
				v: `0x${sig.v.toString(16)}`,
				yParity: `0x${sig.yParity.toString(16)}`,
			},
		};

		// Convert HTTP baseUrl to WebSocket URL
		const wsUrl = `${this.baseUrl.replace(/^http(s)?:\/\//, (match) =>
			match.includes("s") ? "wss://" : "ws://",
		)}/ws/orders`;
		console.log("5");

		this.ws = new WebSocket(wsUrl, undefined, {
			headers: {
				"X-Auth-Data": JSON.stringify(authMessage),
				"X-Forwarded-Proto": "https",
				"X-Forwarded-Port": "443",
				"X-Forwarded-For": "127.0.0.1",
			},
			followRedirects: true,
			handshakeTimeout: 10000,
		});

		console.log("6");
		this.removeWebSocketListeners();
		this.attachWebSocketListeners();
	}

	removeWebSocketListeners() {
		this.ws.removeAllListeners("open");
		this.ws.removeAllListeners("message");
		this.ws.removeAllListeners("error");
		this.ws.removeAllListeners("close");
	}

	attachWebSocketListeners() {
		this.ws.on("open", () => {
			console.info("************* WebSocket connected");
		});

		this.ws.on("message", (data) => {
			try {
				const message = data.toString();

				try {
					const parsedData = JSON.parse(message);

					if (parsedData.order) {
						this.orderQueue.push(parsedData);
						this.processNextBatch();
					} /*else {
            // Echo back non-order messages
            this.ws?.send(message);
          }*/
				} catch (e) {
					console.error("Failed to parse message:", message, e);
					// Echo back non-JSON messages (heartbeats)
					//this.ws?.send(message);
				}
			} catch (error) {
				console.error("Failed to process message:", error);
			}
		});

		this.ws.on("error", (error) => {
			console.error("WebSocket error:", error);
		});

		this.ws.on("close", (code, reason) => {
			console.info("************* WebSocket disconnected", {
				code,
				reason: reason.toString(),
				timestamp: new Date().toISOString(),
			});
		});
	}

	disconnect() {
		if (this.ws) {
			this.removeWebSocketListeners();
			this.ws.terminate();
			this.ws = null;
		}

		this.orderQueue = [];
		console.info("WebSocket client disconnected");
	}
}
