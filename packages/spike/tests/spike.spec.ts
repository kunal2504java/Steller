import { test, expect } from "@playwright/test";

// Regression seed for Candela: a WebAuthn virtual authenticator drives a full
// passkey -> smart-wallet -> sponsored register_issuer round trip against the
// live Probatum testnet contract.
test("passkey wallet creation + sponsored register_issuer", async ({ page }) => {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("WebAuthn.enable");
  await cdp.send("WebAuthn.addVirtualAuthenticator", {
    options: {
      protocol: "ctap2",
      transport: "internal",
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
      automaticPresenceSimulation: true,
    },
  });

  // Surface page console + errors into the test output for debugging.
  page.on("console", (m) => console.log("[page]", m.text()));
  page.on("pageerror", (e) => console.log("[pageerror]", e.message));

  await page.goto("/");

  await page.click("#create");
  await expect(page.locator("#log")).toContainText("wallet-deployed", {
    timeout: 90_000,
  });

  await page.click("#register");
  await expect(page.locator("#log")).toContainText("register_issuer-submitted", {
    timeout: 90_000,
  });

  // Emit evidence (walletId + tx hashes) for the acceptance report.
  const state = await page.evaluate(
    () => (window as unknown as { __spike: Record<string, unknown> }).__spike,
  );
  console.log("SPIKE_EVIDENCE", JSON.stringify(state));
  expect(state.walletId).toBeTruthy();
  expect(state.registerHash).toBeTruthy();
  expect(state.feePayer).not.toEqual(state.walletId); // fees not paid by the wallet
});
