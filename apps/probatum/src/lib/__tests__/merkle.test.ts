import { describe, expect, it } from "vitest";
import { bytesToHex, compareBytes, foldProof, hashPair } from "../merkle";

const fill = (byte: number) => new Uint8Array(32).fill(byte);

describe("sorted-pair merkle", () => {
  it("compares bytes as unsigned values", () => {
    expect(compareBytes(Uint8Array.of(0xff), Uint8Array.of(0x01))).toBeGreaterThan(0);
    expect(compareBytes(Uint8Array.of(0x00, 0xff), Uint8Array.of(0x01, 0x00))).toBeLessThan(0);
  });

  it("reproduces the contract KAT root", async () => {
    const [la, lb, lc, ld] = [0x65, 0x66, 0x67, 0x68].map(fill);
    const ncd = await hashPair(lc, ld);
    const root = await foldProof(la, [lb, ncd]);
    expect(bytesToHex(root)).toBe("57c49ece895537b2bf5dfe5ba421bbf7666f12a00d28a81c29ba0faa52cd1902");
  });
});
