export function compareBytes(a: Uint8Array, b: Uint8Array): number {
  if (a.length !== b.length) return a.length - b.length;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return a[i] - b[i];
  }
  return 0;
}

export async function sha256(bytes: Uint8Array): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", bytes as BufferSource));
}

export async function hashPair(a: Uint8Array, b: Uint8Array): Promise<Uint8Array> {
  if (a.length !== 32 || b.length !== 32) throw new Error("merkle nodes must be 32 bytes");
  const [lo, hi] = compareBytes(a, b) <= 0 ? [a, b] : [b, a];
  const joined = new Uint8Array(64);
  joined.set(lo, 0);
  joined.set(hi, 32);
  return sha256(joined);
}

export async function foldProof(leaf: Uint8Array, proof: Uint8Array[]) {
  let node = leaf;
  for (const sibling of proof) node = await hashPair(node, sibling);
  return node;
}

export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function hexToBytes(hex: string): Uint8Array {
  if (!/^[0-9a-f]{64}$/.test(hex)) throw new Error("expected lowercase 32-byte hex");
  return Uint8Array.from(hex.match(/../g)!, (pair) => Number.parseInt(pair, 16));
}
