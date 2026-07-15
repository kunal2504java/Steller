// @vitest-environment node

import { describe, expect, it, vi } from "vitest";
import { handleSubmit } from "./handler";
import { POST } from "./route";

function request(body: unknown, origin = "https://probatum.test") {
  return new Request("https://probatum.test/api/candela/submit", {
    method: "POST",
    headers: { "content-type": "application/json", origin },
    body: JSON.stringify(body),
  });
}

describe("POST /api/candela/submit", () => {
  it("submits an allowed same-origin envelope", async () => {
    const submit = vi.fn().mockResolvedValue({ hash: "abc123", status: "SUCCESS" as const });
    const response = await handleSubmit(request({ transaction: "inert-xdr" }), submit);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ hash: "abc123", status: "SUCCESS" });
    expect(submit).toHaveBeenCalledWith("inert-xdr");
  });

  it("rejects cross-origin requests before parsing", async () => {
    const response = await POST(request({ transaction: "inert-xdr" }, "https://evil.example"));
    expect(response.status).toBe(403);
  });

  it("bounds the JSON body", async () => {
    const response = await POST(request({ transaction: "x".repeat(70_000) }));
    expect(response.status).toBe(413);
  });

  it("does not echo rejected transaction internals", async () => {
    const submit = vi.fn(async () => {
      throw new Error("secret SXXX and raw envelope");
    });
    const response = await handleSubmit(request({ transaction: "sensitive-xdr" }), submit);
    expect(response.status).toBe(500);
    const payload = await response.text();
    expect(payload).not.toContain("SXXX");
    expect(payload).not.toContain("sensitive-xdr");
  });
});
