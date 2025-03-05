export function fastTrim(input: string) {
  const len = input.length;
  const arr = new Uint8Array(len);
  let j = 0;

  for (let i = 0; i < len; i++) {
    const c = input.charCodeAt(i);
    if (
      (c >= 48 && c <= 57) || // 0-9
      (c >= 65 && c <= 90) || // A-Z
      (c >= 97 && c <= 122) // a-z
    ) {
      arr[j++] = c;
    }
  }

  return String.fromCharCode.apply(null, Array.from(arr.subarray(0, j)));
}
