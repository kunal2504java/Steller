/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_RPC_URL: string;
  readonly VITE_NETWORK_PASSPHRASE: string;
  readonly VITE_CONTRACT_ID: string;
  readonly VITE_WALLET_WASM_HASH: string;
  readonly VITE_LAUNCHTUBE_URL: string;
  readonly VITE_LAUNCHTUBE_JWT: string;
  readonly VITE_FALLBACK_SECRET: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
