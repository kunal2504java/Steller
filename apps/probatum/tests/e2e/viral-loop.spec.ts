import { expect, test, type Page } from "@playwright/test";
import demo from "../../../../fixtures/probatum-testnet-demo.json";

async function firstUnclaimedDemo(page: Page) {
  for (const certificate of demo.certificates) {
    await page.goto(`/verify/${certificate.routeId}`);
    const valid = page.getByRole("heading", { name: "Valid", exact: true });
    const revoked = page.getByRole("heading", { name: "Revoked", exact: true });
    await expect(valid.or(revoked)).toBeVisible({ timeout: 90_000 });
    if (await revoked.count()) continue;
    const claimed = page.getByText("Already claimed", { exact: true });
    const available = page.getByRole("button", { name: "Create passkey wallet" });
    await expect(claimed.or(available)).toBeVisible({ timeout: 90_000 });
    if (await claimed.count()) continue;
    return certificate;
  }
  throw new Error("fresh demo seed required: all committed batch #2 certificate leaves are already claimed");
}

test("Probatum: verify, create, reload-hydrate, claim, and share on live testnet", async ({ page }) => {
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

  page.on("console", (message) => console.log("[page]", message.text()));
  page.on("pageerror", (error) => console.log("[pageerror]", error.message));

  const certificate = await firstUnclaimedDemo(page);
  await page.getByRole("button", { name: "Create passkey wallet" }).click();
  await expect(page.getByText("Ready to claim", { exact: true })).toBeVisible({ timeout: 120_000 });
  const panel = page.locator("[data-wallet-id]");
  const wallet = await panel.getAttribute("data-wallet-id");
  expect(wallet).toMatch(/^C[A-Z2-7]{55}$/);

  // The consuming app must restore Candela's persisted identity on reload.
  await page.reload();
  await expect(page.getByText("Ready to claim", { exact: true })).toBeVisible({ timeout: 90_000 });
  await expect(page.locator(`[data-wallet-id="${wallet}"]`)).toBeVisible();

  await page.getByRole("button", { name: "Claim this certificate" }).click();
  // The virtual authenticator can finish the observable signing phase in a
  // single render tick; its state transition is covered deterministically by
  // the useSubmit unit test. The live proof waits for chain confirmation.
  await expect(page.getByText("Claim confirmed", { exact: true })).toBeVisible({ timeout: 120_000 });
  const transactionHref = await page.getByRole("link", { name: /view confirmed transaction/i }).getAttribute("href");
  const transaction = transactionHref?.match(/\/tx\/([0-9a-f]{64})$/)?.[1];
  expect(transaction).toMatch(/^[0-9a-f]{64}$/);

  await expect(page.getByText("Already claimed", { exact: true })).toBeVisible({ timeout: 30_000 });
  await expect(page.locator(`a.claim-address[href$="/contract/${wallet}"]`)).toBeVisible();
  await expect(page.getByRole("link", { name: /share on linkedin/i })).toBeVisible();
  await expect(page.getByAltText("QR code for this certificate verification link")).toBeVisible();

  await page.reload();
  await expect(page.getByText("Already claimed", { exact: true })).toBeVisible({ timeout: 90_000 });
  await expect(page.locator(`a.claim-address[href$="/contract/${wallet}"]`)).toBeVisible();

  console.log("PROBATUM_E2E_EVIDENCE", JSON.stringify({
    batchId: certificate.batchId,
    certificateId: certificate.payload.certificateId,
    leaf: certificate.leaf,
    wallet,
    transaction,
  }));
});
