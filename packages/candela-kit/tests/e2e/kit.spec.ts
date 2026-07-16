import { test, expect } from "@playwright/test";

// Ported from packages/spike/tests/spike.spec.ts — same CDP virtual-authenticator
// block — but drives the candela-kit PLAYGROUND (the kit's public API) instead of
// the raw spike. A WebAuthn virtual authenticator carries a full passkey ->
// smart-wallet lifecycle against the live v3 Probatum testnet contract.
test("kit: create, reload-hydrate, resident sign-in, and submit on live testnet", async ({
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
  const createdWallet = await page.locator("#wallet").textContent();
  expect(createdWallet).toMatch(/^C[A-Z2-7]{55}$/);
  await expect.poll(() => page.evaluate(() => localStorage.getItem("candela-playground:testnet:wallet")))
    .not.toBeNull();

  // Reload hydration must restore the same wallet without a second WebAuthn prompt.
  await page.reload();
  await expect(page.locator("#hydrated")).toHaveText("true");
  await expect(page.locator("#wallet")).toHaveText(createdWallet!);

  await page.click("#register");
  await expect(page.locator("#log")).toContainText(
    "register_issuer-submitted:",
    { timeout: 90_000 },
  );
  await expect(page.locator("#state")).toHaveText("confirmed");
  const registerEvidence = await page.locator("#log").textContent();

  // Remove only Candela's app persistence. The authenticator's resident key
  // remains, so SignInButton must discover it and reconnect the same wallet.
  await page.evaluate(() => localStorage.removeItem("candela-playground:testnet:wallet"));
  await page.reload();
  await expect(page.locator("#hydrated")).toHaveText("true");
  await expect(page.locator("#wallet")).toHaveText("disconnected");
  await page.getByRole("button", { name: /sign in with passkey/i }).click();
  await expect(page.locator("#log")).toContainText("wallet-connected:", { timeout: 90_000 });
  await expect(page.locator("#wallet")).toHaveText(createdWallet!);

  await page.click("#update");
  await expect(page.locator("#log")).toContainText("update_issuer-submitted:", { timeout: 90_000 });
  await expect(page.locator("#state")).toHaveText("confirmed");

  const updateEvidence = await page.locator("#log").textContent();
  console.log("KIT_E2E_EVIDENCE", JSON.stringify({
    wallet: createdWallet,
    register: registerEvidence,
    update: updateEvidence,
  }));
});
