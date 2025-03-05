export function strip0xPrefix(value: string) {
  return value.startsWith("0x") ? value.slice(2) : value;
}
