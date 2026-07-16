import "server-only";

import { cache } from "react";
import {
  Address,
  nativeToScVal,
  scValToNative,
  xdr,
} from "@stellar/stellar-base";
import { rpc } from "@stellar/stellar-sdk";
import { Buffer } from "buffer";
import {
  decodeEnvelope,
  hashCertificate,
  type CertificateEnvelope,
  type VerificationState,
} from "./certificate";
import { bytesToHex, foldProof, hexToBytes } from "./merkle";
import type { Batch } from "./probatum-bindings";
import { CONTRACT_ID, RPC_URL } from "./chain";

export type VerificationBatch = {
  root: Uint8Array;
  issuer: string;
  revoked: boolean;
  anchoredAt: bigint;
  count: number;
  meta: Uint8Array;
};

export type VerificationChain = {
  getBatch(batchId: number): Promise<VerificationBatch | null>;
  isBatchRevoked(batchId: number): Promise<boolean>;
  isLeafRevoked(batchId: number, leaf: Uint8Array): Promise<boolean>;
  claimOf(batchId: number, leaf: Uint8Array): Promise<string | null>;
  getIssuerProfile(issuer: string): Promise<Uint8Array | null>;
};

type ResolutionBase = {
  envelope: CertificateEnvelope | null;
  leafHex: string | null;
  durationMs: number;
};

export type VerificationResolved = ResolutionBase & {
  kind: "resolved";
  state: VerificationState;
  reason: "verified" | "revoked" | "invalid-envelope" | "missing-batch" | "proof-mismatch";
  batch: VerificationBatch | null;
  claimedBy: string | null;
  issuerProfileHex: string | null;
};

export type VerificationUnavailable = ResolutionBase & {
  kind: "unavailable";
  state: null;
  reason: "rpc-unavailable";
};

export type VerificationResult = VerificationResolved | VerificationUnavailable;

function elapsed(start: number) {
  return Math.round((performance.now() - start) * 10) / 10;
}

function bytesEqual(a: Uint8Array, b: Uint8Array) {
  if (a.length !== b.length) return false;
  return a.every((byte, index) => byte === b[index]);
}

export async function resolveVerification(
  routeId: string,
  chain: VerificationChain,
): Promise<VerificationResult> {
  const startedAt = performance.now();
  let envelope: CertificateEnvelope;
  let leaf: Uint8Array;
  let computedRoot: Uint8Array;
  try {
    envelope = decodeEnvelope(routeId);
    leaf = await hashCertificate(envelope.payload);
    computedRoot = await foldProof(leaf, envelope.proof.map(hexToBytes));
  } catch {
    return {
      kind: "resolved",
      state: "TAMPERED",
      reason: "invalid-envelope",
      envelope: null,
      leafHex: null,
      batch: null,
      claimedBy: null,
      issuerProfileHex: null,
      durationMs: elapsed(startedAt),
    };
  }

  const leafHex = bytesToHex(leaf);
  try {
    const batch = await chain.getBatch(envelope.batchId);
    if (!batch) {
      return {
        kind: "resolved",
        state: "TAMPERED",
        reason: "missing-batch",
        envelope,
        leafHex,
        batch: null,
        claimedBy: null,
        issuerProfileHex: null,
        durationMs: elapsed(startedAt),
      };
    }
    if (!bytesEqual(computedRoot, batch.root)) {
      return {
        kind: "resolved",
        state: "TAMPERED",
        reason: "proof-mismatch",
        envelope,
        leafHex,
        batch,
        claimedBy: null,
        issuerProfileHex: null,
        durationMs: elapsed(startedAt),
      };
    }

    const [batchRevoked, leafRevoked, claimedBy, issuerProfile] = await Promise.all([
      chain.isBatchRevoked(envelope.batchId),
      chain.isLeafRevoked(envelope.batchId, leaf),
      chain.claimOf(envelope.batchId, leaf),
      chain.getIssuerProfile(batch.issuer),
    ]);
    const revoked = batch.revoked || batchRevoked || leafRevoked;
    return {
      kind: "resolved",
      state: revoked ? "REVOKED" : "VALID",
      reason: revoked ? "revoked" : "verified",
      envelope,
      leafHex,
      batch,
      claimedBy,
      issuerProfileHex: issuerProfile ? bytesToHex(issuerProfile) : null,
      durationMs: elapsed(startedAt),
    };
  } catch {
    return {
      kind: "unavailable",
      state: null,
      reason: "rpc-unavailable",
      envelope,
      leafHex,
      durationMs: elapsed(startedAt),
    };
  }
}

function createLiveChain(): VerificationChain {
  // Read the binding's contract-data ABI directly: getLedgerEntries avoids the
  // account lookup + simulation round trip that each generated read method
  // performs. Batch is one request; leaf revocation, claim and issuer profile
  // share a second request. The live acceptance check pins these keys to v3.
  const server = new rpc.Server(RPC_URL);
  const contract = new Address(CONTRACT_ID).toScAddress();
  let loadedBatch: { batchId: number; batch: VerificationBatch } | null = null;
  const supplementalInput: { batchId?: number; leaf?: Uint8Array; issuer?: string } = {};
  let supplementalPromise: Promise<Map<string, unknown>> | null = null;

  function dataKey(variant: string, ...values: xdr.ScVal[]) {
    return xdr.ScVal.scvVec([xdr.ScVal.scvSymbol(variant), ...values]);
  }

  function ledgerKey(key: xdr.ScVal) {
    return xdr.LedgerKey.contractData(new xdr.LedgerKeyContractData({
      contract,
      key,
      durability: xdr.ContractDataDurability.persistent(),
    }));
  }

  function entryId(key: xdr.LedgerKey) {
    return key.toXDR("base64");
  }

  async function readEntries(keys: xdr.LedgerKey[]) {
    const response = await server.getLedgerEntries(...keys);
    return new Map(response.entries.map((entry) => [
      entryId(entry.key),
      scValToNative(entry.val.contractData().val()),
    ]));
  }

  function supplemental(update: Partial<typeof supplementalInput>) {
    Object.assign(supplementalInput, update);
    supplementalPromise ??= Promise.resolve().then(async () => {
      const { batchId, leaf, issuer } = supplementalInput;
      if (batchId == null || !leaf || !issuer) throw new Error("incomplete verification read");
      const keys = [
        ledgerKey(dataKey(
          "RevokedLeaf",
          nativeToScVal(BigInt(batchId), { type: "u64" }),
          nativeToScVal(Buffer.from(leaf)),
        )),
        ledgerKey(dataKey(
          "Claim",
          nativeToScVal(BigInt(batchId), { type: "u64" }),
          nativeToScVal(Buffer.from(leaf)),
        )),
        ledgerKey(dataKey("Issuer", new Address(issuer).toScVal())),
      ];
      return readEntries(keys);
    });
    return supplementalPromise;
  }

  return {
    async getBatch(batchId) {
      const key = ledgerKey(dataKey("Batch", nativeToScVal(BigInt(batchId), { type: "u64" })));
      const entries = await readEntries([key]);
      const native = entries.get(entryId(key)) as Batch | undefined;
      if (!native) return null;
      const batch = {
        root: new Uint8Array(native.root),
        issuer: native.issuer,
        revoked: native.revoked,
        anchoredAt: BigInt(native.anchored_at),
        count: native.count,
        meta: new Uint8Array(native.meta),
      };
      loadedBatch = { batchId, batch };
      return batch;
    },
    async isBatchRevoked(batchId) {
      if (!loadedBatch || loadedBatch.batchId !== batchId) throw new Error("batch was not loaded");
      return loadedBatch.batch.revoked;
    },
    async isLeafRevoked(batchId, leaf) {
      const key = ledgerKey(dataKey(
        "RevokedLeaf",
        nativeToScVal(BigInt(batchId), { type: "u64" }),
        nativeToScVal(Buffer.from(leaf)),
      ));
      return (await supplemental({ batchId, leaf })).has(entryId(key));
    },
    async claimOf(batchId, leaf) {
      const key = ledgerKey(dataKey(
        "Claim",
        nativeToScVal(BigInt(batchId), { type: "u64" }),
        nativeToScVal(Buffer.from(leaf)),
      ));
      const claimant = (await supplemental({ batchId, leaf })).get(entryId(key));
      return typeof claimant === "string" ? claimant : null;
    },
    async getIssuerProfile(issuer) {
      const key = ledgerKey(dataKey("Issuer", new Address(issuer).toScVal()));
      const profile = (await supplemental({ issuer })).get(entryId(key)) as Uint8Array | undefined;
      return profile ? new Uint8Array(profile) : null;
    },
  };
}

export const getVerification = cache((routeId: string) => (
  resolveVerification(routeId, createLiveChain())
));
