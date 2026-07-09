export type CandelaConfig = {
  rpcUrl: string;
  networkPassphrase: string;
  walletWasmHash: string;
  launchtube?: { url: string; jwt: string };
  /** Fallback sponsor (testnet/dev). NEVER commit a real secret. */
  sponsorSecret?: string;
};

const TESTNET: CandelaConfig = {
  rpcUrl: "https://soroban-testnet.stellar.org",
  networkPassphrase: "Test SDF Network ; September 2015",
  walletWasmHash:
    "ecd990f0b45ca6817149b6175f79b32efb442f35731985a084131e8265c4cd90",
};

export function resolveConfig(
  network: "testnet" | CandelaConfig,
): CandelaConfig {
  return network === "testnet" ? { ...TESTNET } : network;
}
