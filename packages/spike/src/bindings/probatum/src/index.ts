import { Buffer } from "buffer";
import { Address } from "@stellar/stellar-sdk/minimal";
import {
  AssembledTransaction,
  Client as ContractClient,
  ClientOptions as ContractClientOptions,
  MethodOptions,
  Result,
  Spec as ContractSpec,
} from "@stellar/stellar-sdk/minimal/contract";
import type {
  u32,
  i32,
  u64,
  i64,
  u128,
  i128,
  u256,
  i256,
  Option,
  Timepoint,
  Duration,
} from "@stellar/stellar-sdk/minimal/contract";
export * as contract from "@stellar/stellar-sdk/minimal/contract";
export * as rpc from "@stellar/stellar-sdk/minimal/rpc";

if (typeof window !== "undefined") {
  //@ts-ignore Buffer exists
  window.Buffer = window.Buffer || Buffer;
}


export const networks = {
  testnet: {
    networkPassphrase: "Test SDF Network ; September 2015",
    contractId: "CBDHK6NAGQBMWHAA442TJ4W7D2JJL5M5RB5NKA4PVZSWQAUVQ2A4CQSF",
  }
} as const


export interface Batch {
  anchored_at: u64;
  count: u32;
  issuer: string;
  meta: Buffer;
  revoked: boolean;
  root: Buffer;
}

export const Errors = {
  1: {message:"AlreadyInitialized"},
  2: {message:"Paused"},
  3: {message:"AlreadyRegistered"},
  4: {message:"NotRegistered"},
  5: {message:"BatchNotFound"},
  6: {message:"NotBatchIssuer"},
  7: {message:"BatchRevoked"},
  8: {message:"LeafRevoked"},
  9: {message:"AlreadyClaimed"},
  10: {message:"InvalidProof"}
}

export type DataKey = {tag: "Admin", values: void} | {tag: "Paused", values: void} | {tag: "BatchSeq", values: void} | {tag: "Issuer", values: readonly [string]} | {tag: "Batch", values: readonly [u64]} | {tag: "RevokedLeaf", values: readonly [u64, Buffer]} | {tag: "Claim", values: readonly [u64, Buffer]};






export interface Client {
  /**
   * Construct and simulate a init transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  init: ({admin}: {admin: string}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a claim transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  claim: ({recipient, batch_id, leaf_hash, proof}: {recipient: string, batch_id: u64, leaf_hash: Buffer, proof: Array<Buffer>}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a pause transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  pause: ({paused}: {paused: boolean}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a version transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  version: (options?: MethodOptions) => Promise<AssembledTransaction<u32>>

  /**
   * Construct and simulate a claim_of transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  claim_of: ({batch_id, leaf_hash}: {batch_id: u64, leaf_hash: Buffer}, options?: MethodOptions) => Promise<AssembledTransaction<Option<string>>>

  /**
   * Construct and simulate a get_batch transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_batch: ({batch_id}: {batch_id: u64}, options?: MethodOptions) => Promise<AssembledTransaction<Option<Batch>>>

  /**
   * Construct and simulate a is_paused transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  is_paused: (options?: MethodOptions) => Promise<AssembledTransaction<boolean>>

  /**
   * Construct and simulate a get_issuer transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_issuer: ({issuer}: {issuer: string}, options?: MethodOptions) => Promise<AssembledTransaction<Option<Buffer>>>

  /**
   * Construct and simulate a batch_count transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  batch_count: (options?: MethodOptions) => Promise<AssembledTransaction<u64>>

  /**
   * Construct and simulate a claim_count transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  claim_count: (options?: MethodOptions) => Promise<AssembledTransaction<u64>>

  /**
   * Construct and simulate a revoke_leaf transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  revoke_leaf: ({issuer, batch_id, leaf_hash}: {issuer: string, batch_id: u64, leaf_hash: Buffer}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a anchor_batch transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  anchor_batch: ({issuer, root, meta, count}: {issuer: string, root: Buffer, meta: Buffer, count: u32}, options?: MethodOptions) => Promise<AssembledTransaction<Result<u64>>>

  /**
   * Construct and simulate a revoke_batch transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  revoke_batch: ({issuer, batch_id}: {issuer: string, batch_id: u64}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a update_issuer transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  update_issuer: ({issuer, profile_hash}: {issuer: string, profile_hash: Buffer}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a is_leaf_revoked transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  is_leaf_revoked: ({batch_id, leaf_hash}: {batch_id: u64, leaf_hash: Buffer}, options?: MethodOptions) => Promise<AssembledTransaction<boolean>>

  /**
   * Construct and simulate a register_issuer transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  register_issuer: ({issuer, profile_hash}: {issuer: string, profile_hash: Buffer}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a is_batch_revoked transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  is_batch_revoked: ({batch_id}: {batch_id: u64}, options?: MethodOptions) => Promise<AssembledTransaction<boolean>>

}
export class Client extends ContractClient {
  static async deploy<T = Client>(
    /** Options for initializing a Client as well as for calling a method, with extras specific to deploying. */
    options: MethodOptions &
      Omit<ContractClientOptions, "contractId"> & {
        /** The hash of the Wasm blob, which must already be installed on-chain. */
        wasmHash: Buffer | string;
        /** Salt used to generate the contract's ID. Passed through to {@link Operation.createCustomContract}. Default: random. */
        salt?: Buffer | Uint8Array;
        /** The format used to decode `wasmHash`, if it's provided as a string. */
        format?: "hex" | "base64";
      }
  ): Promise<AssembledTransaction<T>> {
    return ContractClient.deploy(null, options)
  }
  constructor(public readonly options: ContractClientOptions) {
    super(
      new ContractSpec([ "AAAAAQAAAAAAAAAAAAAABUJhdGNoAAAAAAAABgAAAAAAAAALYW5jaG9yZWRfYXQAAAAABgAAAAAAAAAFY291bnQAAAAAAAAEAAAAAAAAAAZpc3N1ZXIAAAAAABMAAAAAAAAABG1ldGEAAAPuAAAAIAAAAAAAAAAHcmV2b2tlZAAAAAABAAAAAAAAAARyb290AAAD7gAAACA=",
        "AAAABAAAAAAAAAAAAAAABUVycm9yAAAAAAAACgAAAAAAAAASQWxyZWFkeUluaXRpYWxpemVkAAAAAAABAAAAAAAAAAZQYXVzZWQAAAAAAAIAAAAAAAAAEUFscmVhZHlSZWdpc3RlcmVkAAAAAAAAAwAAAAAAAAANTm90UmVnaXN0ZXJlZAAAAAAAAAQAAAAAAAAADUJhdGNoTm90Rm91bmQAAAAAAAAFAAAAAAAAAA5Ob3RCYXRjaElzc3VlcgAAAAAABgAAAAAAAAAMQmF0Y2hSZXZva2VkAAAABwAAAAAAAAALTGVhZlJldm9rZWQAAAAACAAAAAAAAAAOQWxyZWFkeUNsYWltZWQAAAAAAAkAAAAAAAAADEludmFsaWRQcm9vZgAAAAo=",
        "AAAAAgAAAAAAAAAAAAAAB0RhdGFLZXkAAAAABwAAAAAAAAAAAAAABUFkbWluAAAAAAAAAAAAAAAAAAAGUGF1c2VkAAAAAAAAAAAAAAAAAAhCYXRjaFNlcQAAAAEAAAAAAAAABklzc3VlcgAAAAAAAQAAABMAAAABAAAAAAAAAAVCYXRjaAAAAAAAAAEAAAAGAAAAAQAAAAAAAAALUmV2b2tlZExlYWYAAAAAAgAAAAYAAAPuAAAAIAAAAAEAAAAAAAAABUNsYWltAAAAAAAAAgAAAAYAAAPuAAAAIA==",
        "AAAABQAAAIBFbWl0dGVkIHdoZW4gYSByZWNpcGllbnQgc3VjY2Vzc2Z1bGx5IGNsYWltcyBhIGNlcnRpZmljYXRlIGxlYWYuClRvcGljczogKGBjZXJ0X2NsYWltZWRgLCBiYXRjaF9pZCwgcmVjaXBpZW50KS4gRGF0YTogbGVhZl9oYXNoLgAAAAAAAAALQ2VydENsYWltZWQAAAAAAQAAAAxjZXJ0X2NsYWltZWQAAAADAAAAAAAAAAhiYXRjaF9pZAAAAAYAAAABAAAAAAAAAAlyZWNpcGllbnQAAAAAAAATAAAAAQAAAAAAAAAJbGVhZl9oYXNoAAAAAAAD7gAAACAAAAAAAAAAAA==",
        "AAAABQAAAGpFbWl0dGVkIHdoZW4gYSBzaW5nbGUgbGVhZiB3aXRoaW4gYSBiYXRjaCBpcyByZXZva2VkLgpUb3BpY3M6IChgbGVhZl9yZXZva2VkYCwgYmF0Y2hfaWQpLiBEYXRhOiBsZWFmX2hhc2guAAAAAAAAAAAAC0xlYWZSZXZva2VkAAAAAAEAAAAMbGVhZl9yZXZva2VkAAAAAgAAAAAAAAAIYmF0Y2hfaWQAAAAGAAAAAQAAAAAAAAAJbGVhZl9oYXNoAAAAAAAD7gAAACAAAAAAAAAAAA==",
        "AAAABQAAAF5FbWl0dGVkIHdoZW4gYSB3aG9sZSBiYXRjaCBpcyByZXZva2VkLgpUb3BpY3M6IChgYmF0Y2hfcmV2b2tlZGAsIGJhdGNoX2lkKS4gRGF0YTogbm9uZSAoVm9pZCkuAAAAAAAAAAAADEJhdGNoUmV2b2tlZAAAAAEAAAANYmF0Y2hfcmV2b2tlZAAAAAAAAAEAAAAAAAAACGJhdGNoX2lkAAAABgAAAAEAAAAA",
        "AAAAAAAAAAAAAAAEaW5pdAAAAAEAAAAAAAAABWFkbWluAAAAAAAAEwAAAAEAAAPpAAAD7QAAAAAAAAAD",
        "AAAABQAAAF9FbWl0dGVkIHdoZW4gYSBuZXcgYmF0Y2ggaXMgYW5jaG9yZWQuClRvcGljczogKGBiYXRjaF9hbmNob3JlZGAsIGlzc3VlciwgYmF0Y2hfaWQpLiBEYXRhOiByb290LgAAAAAAAAAADUJhdGNoQW5jaG9yZWQAAAAAAAABAAAADmJhdGNoX2FuY2hvcmVkAAAAAAADAAAAAAAAAAZpc3N1ZXIAAAAAABMAAAABAAAAAAAAAAhiYXRjaF9pZAAAAAYAAAABAAAAAAAAAARyb290AAAD7gAAACAAAAAAAAAAAA==",
        "AAAAAAAAAAAAAAAFY2xhaW0AAAAAAAAEAAAAAAAAAAlyZWNpcGllbnQAAAAAAAATAAAAAAAAAAhiYXRjaF9pZAAAAAYAAAAAAAAACWxlYWZfaGFzaAAAAAAAA+4AAAAgAAAAAAAAAAVwcm9vZgAAAAAAA+oAAAPuAAAAIAAAAAEAAAPpAAAD7QAAAAAAAAAD",
        "AAAAAAAAAAAAAAAFcGF1c2UAAAAAAAABAAAAAAAAAAZwYXVzZWQAAAAAAAEAAAAA",
        "AAAAAAAAAAAAAAAHdmVyc2lvbgAAAAAAAAAAAQAAAAQ=",
        "AAAABQAAAHhFbWl0dGVkIHdoZW4gYW4gaXNzdWVyIHByb2ZpbGUgaGFzaCBpcyByZWdpc3RlcmVkIG9yIHVwZGF0ZWQuClRvcGljczogKGBpc3N1ZXJfcmVnaXN0ZXJlZGAsIGlzc3VlcikuIERhdGE6IHByb2ZpbGVfaGFzaC4AAAAAAAAAEElzc3VlclJlZ2lzdGVyZWQAAAABAAAAEWlzc3Vlcl9yZWdpc3RlcmVkAAAAAAAAAgAAAAAAAAAGaXNzdWVyAAAAAAATAAAAAQAAAAAAAAAMcHJvZmlsZV9oYXNoAAAD7gAAACAAAAAAAAAAAA==",
        "AAAAAAAAAAAAAAAIY2xhaW1fb2YAAAACAAAAAAAAAAhiYXRjaF9pZAAAAAYAAAAAAAAACWxlYWZfaGFzaAAAAAAAA+4AAAAgAAAAAQAAA+gAAAAT",
        "AAAAAAAAAAAAAAAJZ2V0X2JhdGNoAAAAAAAAAQAAAAAAAAAIYmF0Y2hfaWQAAAAGAAAAAQAAA+gAAAfQAAAABUJhdGNoAAAA",
        "AAAAAAAAAAAAAAAJaXNfcGF1c2VkAAAAAAAAAAAAAAEAAAAB",
        "AAAAAAAAAAAAAAAKZ2V0X2lzc3VlcgAAAAAAAQAAAAAAAAAGaXNzdWVyAAAAAAATAAAAAQAAA+gAAAPuAAAAIA==",
        "AAAAAAAAAAAAAAALYmF0Y2hfY291bnQAAAAAAAAAAAEAAAAG",
        "AAAAAAAAAAAAAAALY2xhaW1fY291bnQAAAAAAAAAAAEAAAAG",
        "AAAAAAAAAAAAAAALcmV2b2tlX2xlYWYAAAAAAwAAAAAAAAAGaXNzdWVyAAAAAAATAAAAAAAAAAhiYXRjaF9pZAAAAAYAAAAAAAAACWxlYWZfaGFzaAAAAAAAA+4AAAAgAAAAAQAAA+kAAAPtAAAAAAAAAAM=",
        "AAAAAAAAAAAAAAAMYW5jaG9yX2JhdGNoAAAABAAAAAAAAAAGaXNzdWVyAAAAAAATAAAAAAAAAARyb290AAAD7gAAACAAAAAAAAAABG1ldGEAAAPuAAAAIAAAAAAAAAAFY291bnQAAAAAAAAEAAAAAQAAA+kAAAAGAAAAAw==",
        "AAAAAAAAAAAAAAAMcmV2b2tlX2JhdGNoAAAAAgAAAAAAAAAGaXNzdWVyAAAAAAATAAAAAAAAAAhiYXRjaF9pZAAAAAYAAAABAAAD6QAAA+0AAAAAAAAAAw==",
        "AAAAAAAAAAAAAAANdXBkYXRlX2lzc3VlcgAAAAAAAAIAAAAAAAAABmlzc3VlcgAAAAAAEwAAAAAAAAAMcHJvZmlsZV9oYXNoAAAD7gAAACAAAAABAAAD6QAAA+0AAAAAAAAAAw==",
        "AAAAAAAAAAAAAAAPaXNfbGVhZl9yZXZva2VkAAAAAAIAAAAAAAAACGJhdGNoX2lkAAAABgAAAAAAAAAJbGVhZl9oYXNoAAAAAAAD7gAAACAAAAABAAAAAQ==",
        "AAAAAAAAAAAAAAAPcmVnaXN0ZXJfaXNzdWVyAAAAAAIAAAAAAAAABmlzc3VlcgAAAAAAEwAAAAAAAAAMcHJvZmlsZV9oYXNoAAAD7gAAACAAAAABAAAD6QAAA+0AAAAAAAAAAw==",
        "AAAAAAAAAAAAAAAQaXNfYmF0Y2hfcmV2b2tlZAAAAAEAAAAAAAAACGJhdGNoX2lkAAAABgAAAAEAAAAB" ]),
      options
    )
  }
  public readonly fromJSON = {
    init: this.txFromJSON<Result<void>>,
        claim: this.txFromJSON<Result<void>>,
        pause: this.txFromJSON<null>,
        version: this.txFromJSON<u32>,
        claim_of: this.txFromJSON<Option<string>>,
        get_batch: this.txFromJSON<Option<Batch>>,
        is_paused: this.txFromJSON<boolean>,
        get_issuer: this.txFromJSON<Option<Buffer>>,
        batch_count: this.txFromJSON<u64>,
        claim_count: this.txFromJSON<u64>,
        revoke_leaf: this.txFromJSON<Result<void>>,
        anchor_batch: this.txFromJSON<Result<u64>>,
        revoke_batch: this.txFromJSON<Result<void>>,
        update_issuer: this.txFromJSON<Result<void>>,
        is_leaf_revoked: this.txFromJSON<boolean>,
        register_issuer: this.txFromJSON<Result<void>>,
        is_batch_revoked: this.txFromJSON<boolean>
  }
}