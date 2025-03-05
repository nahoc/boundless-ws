// from https://github.com/boundless-xyz/boundless/blob/main/contracts/src/BoundlessMarketLib.sol
export const EIP712_TYPES = {
  ProofRequest: [
    { name: "id", type: "uint256" },
    { name: "requirements", type: "Requirements" },
    { name: "imageUrl", type: "string" },
    { name: "input", type: "Input" },
    { name: "offer", type: "Offer" },
  ],
  Requirements: [
    { name: "imageId", type: "bytes32" },
    { name: "predicate", type: "Predicate" },
  ],
  Predicate: [
    { name: "predicateType", type: "uint8" },
    { name: "data", type: "bytes" },
  ],
  Input: [
    { name: "inputType", type: "uint8" },
    { name: "data", type: "bytes" },
  ],
  Offer: [
    { name: "minPrice", type: "uint256" },
    { name: "maxPrice", type: "uint256" },
    { name: "biddingStart", type: "uint64" },
    { name: "rampUpPeriod", type: "uint32" },
    { name: "timeout", type: "uint32" },
    { name: "lockStake", type: "uint256" },
  ],
} as const;
