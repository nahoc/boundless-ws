// support bigint serialization in JSON
Object.defineProperty(BigInt.prototype, "toJSON", {
  get() {
    return () => String(this);
  },
  configurable: true,
});
