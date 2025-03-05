export function strip0xPrefix(value) {
	return value.startsWith("0x") ? value.slice(2) : value;
}
