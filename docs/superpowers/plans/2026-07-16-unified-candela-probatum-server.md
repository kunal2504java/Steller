# Unified Candela + Probatum Server Implementation Plan

**Goal:** Ship one Next.js server where Candela is the primary `/` experience, Probatum is linked at `/probatum`, and public verification remains at `/verify/[id]` with the existing claim/sponsor backend on the same origin.

**Architecture decision:** Keep `apps/probatum` as the deployable shell because it already owns the verified Soroban reader, sponsor route, passkey claim island, QR/OG generation, and Playwright lifecycle. Reuse the approved Candela landing components from `apps/candela` for the unified root rather than porting security-sensitive Probatum infrastructure into the presentation-only app. The legacy `apps/candela` package remains buildable during this transition but is no longer the server users should run.

**Visual thesis:** Candela remains the monochrome full-bleed product poster; Probatum appears as its living proof, not a competing product homepage.

**Content plan:** Candela hero -> live terminal -> mechanism -> Probatum use case -> product thesis -> final install CTA. `/probatum` retains its certificate-specific hero, proof stack, and verification CTA.

**Interaction thesis:** Retain the existing hero/terminal entrance, scroll-triggered reveals, metallic hover states, and complete static frames under `prefers-reduced-motion`.

## Task 1: Pin the single-origin URL contract with a failing test

**Files:**
- Modify: `apps/probatum/src/lib/__tests__/site.test.ts`
- Modify: `apps/probatum/src/lib/site.ts`

- [ ] Change the default canonical origin expectation from `https://probatum.app` to `https://candela.dev` and assert verification URLs remain `/verify/[id]`.
- [ ] Run the focused test and confirm it fails because the old Probatum origin is still returned.
- [ ] Change only the default origin implementation; retain the existing environment override and URL validation.
- [ ] Re-run the focused test green.

## Task 2: Make Candela `/` and move Probatum to `/probatum`

**Files:**
- Modify: `apps/probatum/src/app/page.tsx`
- Create: `apps/probatum/src/app/probatum/page.tsx`
- Modify: `apps/probatum/src/app/layout.tsx`
- Modify: `apps/probatum/src/lib/chain.ts`
- Modify: `apps/probatum/src/app/globals.css`
- Modify: `apps/candela/src/components/Hero.tsx`
- Modify: `apps/candela/src/components/UseCase.tsx`

- [ ] Move the current Probatum page composition unchanged to `/probatum`, including live stats, QR, and seeded proof links.
- [ ] Compose the approved Candela landing at `/` using its existing components and the unified app's live chain reader.
- [ ] Expose `sponsoredTxns` as the truthful claim counter alias consumed by Candela's existing use-case block.
- [ ] Add the existing terminal styles needed by the reused Candela terminal; do not introduce fonts, colors, or motion.
- [ ] Make Candela's Probatum CTAs same-origin `/probatum` links.
- [ ] Set root metadata to Candela. Export route-specific Probatum metadata from `/probatum`.

## Task 3: Repair navigation for the new hierarchy

**Files:**
- Modify: `apps/probatum/src/app/verify/[id]/VerificationView.tsx`
- Modify only other components containing root links if discovered by search.

- [ ] Point “Probatum home” and “Back to Probatum” to `/probatum`, not `/`.
- [ ] Confirm landing demo, QR, LinkedIn, and OG links remain same-origin `/verify/[id]` URLs.
- [ ] Confirm Candela visibly links to Probatum from hero and use-case sections.

## Task 4: Verify one-server behavior

**Files:**
- Modify only files required by defects discovered during verification.

- [ ] Stop both development servers before any build.
- [ ] Run `pnpm --filter probatum-web test`, TypeScript, and production build.
- [ ] Run Candela's tests and production build because its shared landing components changed.
- [ ] Start only `probatum-web` on port 3000.
- [ ] Browser-check `/` = Candela, `/probatum` = Probatum, and a seeded `/verify/[id]` proof = live verdict/claim UI.
- [ ] Check same-origin navigation, canonical LinkedIn/QR/OG targets, keyboard focus, 375px layout, reduced motion, and zero console errors.
- [ ] Secret-scan the diff. Confirm no deployment ID was hardcoded and no `.env` was staged.
- [ ] Commit scoped changes conventionally. Do not publish, deploy mainnet, or touch sponsor secrets.
