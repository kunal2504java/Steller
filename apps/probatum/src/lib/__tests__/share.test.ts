import { describe, expect, it, vi } from "vitest";
import { verificationQrDataUrl } from "../share";

describe("verificationQrDataUrl", () => {
  it("encodes the canonical verify URL with a quiet zone and monochrome contrast", async () => {
    const encode = vi.fn(async () => "data:image/png;base64,qr");
    const url = "https://proof.example/verify/certificate";
    await expect(verificationQrDataUrl(url, encode)).resolves.toBe("data:image/png;base64,qr");
    expect(encode).toHaveBeenCalledWith(url, expect.objectContaining({
      errorCorrectionLevel: "M",
      margin: 2,
      width: 240,
      color: { dark: "#000000", light: "#ffffff" },
    }));
  });
});
