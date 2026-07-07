import "server-only";

/**
 * Read-only contract stats for the landing page. Numbers come from the
 * chain, not a CMS — that's the whole point. Fails soft to em-dashes so
 * an RPC hiccup can never break the page.
 */

const CONTRACT_ID = "CBDHK6NAGQBMWHAA442TJ4W7D2JJL5M5RB5NKA4PVZSWQAUVQ2A4CQSF";
const RPC_URL = "https://soroban-testnet.stellar.org";
const NETWORK_PASSPHRASE = "Test SDF Network ; September 2015";
// Any funded account works as a simulation source for read-only calls.
const SIM_SOURCE = "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7";

export type ChainStats = {
  batches: string;
  claims: string;
  network: string;
  contractUrl: string;
};

const FALLBACK: ChainStats = {
  batches: "—",
  claims: "—",
  network: "testnet",
  contractUrl: `https://stellar.expert/explorer/testnet/contract/${CONTRACT_ID}`,
};

async function simulateRead(fn: "batch_count" | "claim_count"): Promise<bigint> {
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
    const [batches, claims] = await Promise.all([
      simulateRead("batch_count"),
      simulateRead("claim_count"),
    ]);
    return {
      ...FALLBACK,
      batches: batches.toLocaleString("en-IN"),
      claims: claims.toLocaleString("en-IN"),
    };
  } catch {
    return FALLBACK;
  }
}
