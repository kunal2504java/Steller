import { test, expect } from "@playwright/test";

// Ported from packages/spike/tests/spike.spec.ts — same CDP virtual-authenticator
// block — but drives the candela-kit PLAYGROUND (the kit's public API) instead of
// the raw spike. A WebAuthn virtual authenticator carries a full passkey ->
// smart-wallet -> sponsored register_issuer round trip against the live v2
// Probatum testnet contract.
test("kit: passkey wallet + sponsored register_issuer on live testnet", async ({
  page,
}) => {
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

  await page.getByRole("button", { name: /sign up with passkey/i }).click();
  await expect(page.locator("#log")).toContainText("wallet-deployed:", {
    timeout: 90_000,
  });

  await page.click("#register");
  await expect(page.locator("#log")).toContainText(
    "register_issuer-submitted:",
    { timeout: 90_000 },
  );
  await expect(page.locator("#state")).toHaveText("confirmed");

  // Emit the new walletId + register tx hash for the acceptance report / CLI
  // verification (get_issuer --issuer <walletId>).
  const evidence = await page.locator("#log").textContent();
  console.log("KIT_E2E_EVIDENCE", JSON.stringify(evidence));
});
