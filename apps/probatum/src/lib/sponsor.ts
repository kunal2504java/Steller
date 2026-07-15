import "server-only";

import {
  Address,
  FeeBumpTransaction,
  Keypair,
  Operation,
  Transaction,
  TransactionBuilder,
  hash,
  type Operation as StellarOperation,
} from "@stellar/stellar-base";
import { rpc } from "@stellar/stellar-sdk";
import { Buffer } from "buffer";
import deployment from "../../../../deployments/testnet.json";

export const NETWORK_PASSPHRASE = "Test SDF Network ; September 2015";
export const RPC_URL = "https://soroban-testnet.stellar.org";
export const MAX_INNER_FEE = 10_000_000n;
const WALLET_WASM_HASH = "ecd990f0b45ca6817149b6175f79b32efb442f35731985a084131e8265c4cd90";
const MAX_POLL_ATTEMPTS = 30;

export type AllowedSubmission = {
  kind: "wallet-deploy" | "claim";
  transaction: Transaction;
};

export class SubmissionValidationError extends Error {}

export function walletDeploymentSource(): string {
  return Keypair.fromRawEd25519Seed(hash(Buffer.from("kalepail"))).publicKey();
}

function reject(message: string): never {
  throw new SubmissionValidationError(message);
}

function parseTransaction(transactionXdr: string): Transaction {
  if (typeof transactionXdr !== "string" || transactionXdr.length === 0 || transactionXdr.length > 60_000) {
    return reject("malformed transaction XDR");
  }
  try {
    const parsed = TransactionBuilder.fromXDR(transactionXdr, NETWORK_PASSPHRASE);
    if (parsed instanceof FeeBumpTransaction || !(parsed instanceof Transaction)) {
      return reject("fee-bump envelopes are not accepted");
    }
    return parsed;
  } catch {
    return reject("malformed transaction XDR");
  }
}

function validateCommon(transaction: Transaction): StellarOperation {
  if (transaction.operations.length !== 1) reject("exactly one operation is required");
  if (BigInt(transaction.fee) > MAX_INNER_FEE) reject("transaction fee exceeds sponsor ceiling");
  const operation = transaction.operations[0];
  if (operation.type !== "invokeHostFunction") reject("operation is not allowed");
  if (operation.source && operation.source !== transaction.source) reject("operation source is not allowed");
  return operation;
}

function isWalletDeployment(transaction: Transaction, operation: StellarOperation): boolean {
  if (transaction.source !== walletDeploymentSource() || operation.type !== "invokeHostFunction") return false;
  const func = operation.func;
  if (func.switch().name !== "hostFunctionTypeCreateContractV2") return false;
  const create = func.createContractV2();
  if (create.executable().switch().name !== "contractExecutableWasm") reject("wallet executable must be Wasm");
  if (!Buffer.from(create.executable().wasmHash()).equals(Buffer.from(WALLET_WASM_HASH, "hex"))) {
    reject("wallet Wasm hash is not allowed");
  }
  const preimage = create.contractIdPreimage();
  if (preimage.switch().name !== "contractIdPreimageFromAddress") reject("wallet contract preimage is not allowed");
  const deploymentAddress = Address.fromScAddress(preimage.fromAddress().address()).toString();
  if (deploymentAddress !== walletDeploymentSource()) reject("wallet deployment address is not allowed");

  const signatures = transaction.signatures;
  if (signatures.length !== 1) reject("wallet deployment signature is required");
  const signer = Keypair.fromPublicKey(walletDeploymentSource());
  if (!signer.verify(transaction.hash(), signatures[0].signature())) {
    reject("wallet deployment signature or network is invalid");
  }
  return true;
}

function isClaim(transaction: Transaction, operation: StellarOperation): boolean {
  if (transaction.source !== deployment.adminPublic || operation.type !== "invokeHostFunction") return false;
  const func = operation.func;
  if (func.switch().name !== "hostFunctionTypeInvokeContract") return false;
  const invocation = func.invokeContract();
  const contractId = Address.fromScAddress(invocation.contractAddress()).toString();
  const functionName = invocation.functionName().toString();
  if (contractId !== deployment.contractId || functionName !== "claim") {
    reject("contract function is not allowed");
  }
  if (invocation.args().length !== 4) reject("claim arguments are malformed");
  if (operation.auth?.length !== 1) reject("one wallet authorization is required");
  const authorization = operation.auth[0];
  if (authorization.credentials().switch().name !== "sorobanCredentialsAddress") {
    reject("wallet address authorization is required");
  }
  const authorizedAddress = Address.fromScAddress(
    authorization.credentials().address().address(),
  ).toString();
  const recipient = Address.fromScVal(invocation.args()[0]).toString();
  if (authorizedAddress !== recipient) reject("wallet authorization does not match recipient");
  const rootFunction = authorization.rootInvocation().function();
  if (rootFunction.switch().name !== "sorobanAuthorizedFunctionTypeContractFn") {
    reject("wallet authorization root is not allowed");
  }
  const authorizedCall = rootFunction.contractFn();
  if (
    Address.fromScAddress(authorizedCall.contractAddress()).toString() !== deployment.contractId ||
    authorizedCall.functionName().toString() !== "claim"
  ) {
    reject("wallet authorization root is not allowed");
  }
  if (transaction.signatures.length !== 0) reject("claim transaction must be unsigned by its source");
  return true;
}

export function validateSubmission(transactionXdr: string): AllowedSubmission {
  const transaction = parseTransaction(transactionXdr);
  const operation = validateCommon(transaction);
  if (isWalletDeployment(transaction, operation)) return { kind: "wallet-deploy", transaction };
  if (isClaim(transaction, operation)) return { kind: "claim", transaction };
  reject("transaction source or operation is not allowed");
}

function requireSponsor(secret = process.env.PROBATUM_SPONSOR_SECRET): Keypair {
  if (!secret) throw new Error("sponsor is not configured");
  let sponsor: Keypair;
  try {
    sponsor = Keypair.fromSecret(secret);
  } catch {
    throw new Error("sponsor configuration is invalid");
  }
  if (sponsor.publicKey() !== deployment.adminPublic) {
    throw new Error("sponsor configuration does not match deployment admin");
  }
  return sponsor;
}

function sponsorTransaction(allowed: AllowedSubmission, sponsor: Keypair): Transaction | FeeBumpTransaction {
  if (allowed.kind === "claim") {
    allowed.transaction.sign(sponsor);
    return allowed.transaction;
  }
  const sorobanData = allowed.transaction.toEnvelope().v1().tx().ext().value();
  const resourceFee = BigInt(sorobanData?.resourceFee().toString() ?? 0);
  let baseFee = BigInt(allowed.transaction.fee) - resourceFee;
  if (baseFee < 100n) baseFee = 100n;
  const feeBump = TransactionBuilder.buildFeeBumpTransaction(
    sponsor.publicKey(),
    baseFee.toString(),
    allowed.transaction,
    NETWORK_PASSPHRASE,
  );
  feeBump.sign(sponsor);
  return feeBump;
}

async function waitForSuccess(server: rpc.Server, hash: string): Promise<void> {
  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt += 1) {
    const result = await server.getTransaction(hash);
    if (result.status === "SUCCESS") return;
    if (result.status !== "NOT_FOUND") throw new Error("sponsored transaction failed on-chain");
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  throw new Error("sponsored transaction confirmation timed out");
}

export async function submitSponsoredTransaction(
  transactionXdr: string,
  secret?: string,
): Promise<{ hash: string; status: "SUCCESS" }> {
  const allowed = validateSubmission(transactionXdr);
  const sponsor = requireSponsor(secret);
  const server = new rpc.Server(RPC_URL);
  const signed = sponsorTransaction(allowed, sponsor);
  const sent = await server.sendTransaction(signed);
  if (sent.status === "ERROR") throw new Error("sponsored transaction was rejected");
  await waitForSuccess(server, sent.hash);
  return { hash: sent.hash, status: "SUCCESS" };
}
