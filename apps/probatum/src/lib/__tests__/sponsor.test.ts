// @vitest-environment node

import {
  Account,
  Address,
  Keypair,
  Operation,
  TransactionBuilder,
  hash,
  nativeToScVal,
  xdr,
} from "@stellar/stellar-base";
import { Buffer } from "buffer";
import { describe, expect, it } from "vitest";
import deployment from "../../../../../deployments/testnet.json";
import {
  MAX_INNER_FEE,
  NETWORK_PASSPHRASE,
  validateSubmission,
  walletDeploymentSource,
} from "../sponsor";

const walletSource = walletDeploymentSource();
const sponsorSource = deployment.adminPublic;

function buildWalletDeploy(options: {
  wasmHash?: string;
  fee?: string;
  source?: string;
  networkPassphrase?: string;
} = {}) {
  const source = options.source ?? walletSource;
  const networkPassphrase = options.networkPassphrase ?? NETWORK_PASSPHRASE;
  const tx = new TransactionBuilder(new Account(source, "1"), {
    fee: options.fee ?? "100",
    networkPassphrase,
  })
    .addOperation(Operation.createCustomContract({
      address: new Address(source),
      wasmHash: Buffer.from(options.wasmHash ?? "ecd990f0b45ca6817149b6175f79b32efb442f35731985a084131e8265c4cd90", "hex"),
      salt: Buffer.alloc(32, 7),
      constructorArgs: [],
    }))
    .setTimeout(30)
    .build();
  const deploymentKey = Keypair.fromRawEd25519Seed(hash(Buffer.from("kalepail")));
  if (source === walletSource) tx.sign(deploymentKey);
  return tx;
}

const recipient = "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM";

function claimOperation(functionName = "claim", contractId = deployment.contractId, includeAuth = true) {
  const args = [
    new Address(recipient).toScVal(),
    nativeToScVal(2n, { type: "u64" }),
    nativeToScVal(Buffer.alloc(32, 1)),
    nativeToScVal([], { type: ["symbol"] }),
  ];
  const auth = new xdr.SorobanAuthorizationEntry({
    credentials: xdr.SorobanCredentials.sorobanCredentialsAddress(
      new xdr.SorobanAddressCredentials({
        address: new Address(recipient).toScAddress(),
        nonce: xdr.Int64.fromString("1"),
        signatureExpirationLedger: 99,
        signature: xdr.ScVal.scvVoid(),
      }),
    ),
    rootInvocation: new xdr.SorobanAuthorizedInvocation({
      function: xdr.SorobanAuthorizedFunction.sorobanAuthorizedFunctionTypeContractFn(
        new xdr.InvokeContractArgs({
          contractAddress: new Address(contractId).toScAddress(),
          functionName,
          args,
        }),
      ),
      subInvocations: [],
    }),
  });
  return Operation.invokeContractFunction({
    contract: contractId,
    function: functionName,
    args,
    auth: includeAuth ? [auth] : [],
  });
}

function buildClaim(options: { source?: string; fee?: string; operation?: ReturnType<typeof claimOperation> } = {}) {
  return new TransactionBuilder(new Account(options.source ?? sponsorSource, "1"), {
    fee: options.fee ?? "100",
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(options.operation ?? claimOperation())
    .setTimeout(30)
    .build();
}

describe("validateSubmission", () => {
  it("accepts only the passkey-kit wallet deployment shape", () => {
    const result = validateSubmission(buildWalletDeploy().toXDR());
    expect(result.kind).toBe("wallet-deploy");
  });

  it("accepts only the Probatum claim shape", () => {
    const result = validateSubmission(buildClaim().toXDR());
    expect(result.kind).toBe("claim");
  });

  it.each([
    ["malformed XDR", "not-xdr", /malformed/i],
    ["wrong source", buildClaim({ source: walletSource }).toXDR(), /source/i],
    ["excessive fee", buildClaim({ fee: (MAX_INNER_FEE + 1n).toString() }).toXDR(), /fee/i],
    ["arbitrary function", buildClaim({ operation: claimOperation("pause") }).toXDR(), /not allowed/i],
    ["arbitrary contract", buildClaim({ operation: claimOperation("claim", "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM") }).toXDR(), /not allowed/i],
    ["missing wallet auth", buildClaim({ operation: claimOperation("claim", deployment.contractId, false) }).toXDR(), /authorization/i],
    ["wrong wallet Wasm", buildWalletDeploy({ wasmHash: "11".repeat(32) }).toXDR(), /wasm/i],
  ])("rejects %s", (_label, transaction, message) => {
    expect(() => validateSubmission(transaction as string)).toThrow(message as RegExp);
  });

  it("rejects multiple operations", () => {
    const tx = new TransactionBuilder(new Account(sponsorSource, "1"), {
      fee: "200",
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(claimOperation())
      .addOperation(claimOperation())
      .setTimeout(30)
      .build();
    expect(() => validateSubmission(tx.toXDR())).toThrow(/one operation/i);
  });

  it("rejects a wallet deployment signed for another network", () => {
    const tx = buildWalletDeploy({ networkPassphrase: "Public Global Stellar Network ; September 2015" });
    expect(() => validateSubmission(tx.toXDR())).toThrow(/signature|network/i);
  });
});
