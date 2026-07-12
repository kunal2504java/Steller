import "server-only";
import deployment from "../../../../deployments/testnet.json";

/**
 * Read-only chain facts for the Candela page. Numbers come from the same
 * live contract Probatum uses — proof the kit is real, not a mock. Fails
 * soft to em-dashes so an RPC hiccup can never break the page.
 */
const CONTRACT_ID = deployment.contractId;
const NETWORK = deployment.network;
const GENESIS_TX = deployment.genesisTx;
const RPC_URL = "https://soroban-testnet.stellar.org";
const NETWORK_PASSPHRASE = "Test SDF Network ; September 2015";
const SIM_SOURCE = "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7";

export type ChainStats = {
  sponsoredTxns: string;
  network: string;
  contractUrl: string;
  genesisTx: string;
};

const FALLBACK: ChainStats = {
  sponsoredTxns: "—",
  network: NETWORK,
  contractUrl: `https://stellar.expert/explorer/testnet/contract/${CONTRACT_ID}`,
  genesisTx: GENESIS_TX,
};

async function simulateRead(fn: "claim_count"): Promise<bigint> {
  const { Contract, TransactionBuilder, Account, rpc, xdr } = await import(
    "@stellar/stellar-sdk"
  );
  const server = new rpc.Server(RPC_URL);
  const contract = new Contract(CONTRACT_ID);
  const tx = new TransactionBuilder(new Account(SIM_SOURCE, "0"), {
    fee: "100",
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call(fn))
    .setTimeout(30)
    .build();
  const sim = await server.simulateTransaction(tx);
  if (!rpc.Api.isSimulationSuccess(sim) || !sim.result?.retval) {
    throw new Error(`simulation failed for ${fn}`);
  }
  const retval: InstanceType<typeof xdr.ScVal> = sim.result.retval;
  return BigInt(retval.u64().toString());
}

export async function getChainStats(): Promise<ChainStats> {
  try {
    const claims = await simulateRead("claim_count");
    return { ...FALLBACK, sponsoredTxns: claims.toLocaleString("en-IN") };
  } catch {
    return FALLBACK;
  }
}
