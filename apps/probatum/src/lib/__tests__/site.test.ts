import { describe, expect, it } from "vitest";
import {
  DEFAULT_SITE_ORIGIN,
  linkedInShareUrl,
  siteOrigin,
  verificationUrl,
} from "../site";

describe("public verification URLs", () => {
  it("normalizes an explicit public origin", () => {
    expect(siteOrigin(" https://proof.example/launch/ ")).toBe("https://proof.example");
  });

  it("falls back for invalid or non-http origins", () => {
    expect(siteOrigin("javascript:alert(1)")).toBe(DEFAULT_SITE_ORIGIN);
    expect(siteOrigin("not a url")).toBe(DEFAULT_SITE_ORIGIN);
  });

  it("builds the canonical encoded verification URL", () => {
    expect(verificationUrl("proof_1", "https://proof.example/"))
      .toBe("https://proof.example/verify/proof_1");
  });

  it("builds LinkedIn's share-offsite URL with the proof link encoded", () => {
    const verify = "https://proof.example/verify/a_b-c";
    expect(linkedInShareUrl(verify)).toBe(
      `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(verify)}`,
    );
  });
});
