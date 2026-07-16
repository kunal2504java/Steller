# Certificate claim links

Probatum claim links are bearer-style proof links. The current public testnet demo deliberately makes seeded certificates discoverable so the Candela passkey flow can be tested end to end. Consequently, the first wallet to submit a valid proof can claim that demo leaf.

Production issuers must deliver each encoded verification link privately to its intended recipient. Probatum stores only the certificate leaf hash and claimant wallet address on-chain; it does not store certificate payloads or personally identifying information.

The contract currently enforces one claimant per `(batch_id, leaf_hash)`, but the leaf itself is not cryptographically bound to a predetermined recipient wallet. Before mainnet, choose and document one of these controls:

- preserve confidential bearer-link delivery and make the risk explicit to issuers and recipients; or
- add recipient commitment/domain separation to the leaf schema and contract validation.

Claiming is non-custodial. It binds a proof hash to a passkey smart-wallet address and does not mint, transfer, purchase, or custody any token or fiat asset.
