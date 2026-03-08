export interface TokenInfo {
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  totalSupply: string;
  balance: string;
}

export interface DangerTransfer {
  id?: number;
  tokenAddress: string;
  tokenName: string;
  tokenSymbol: string;
  fromWallet: string;
  toWallet: string;
  amount: string;
  txHash: string;
  walletPosition: number;
  transferCount: number;
  detectedAt: string;
  sellTriggered: boolean;
  sellTxHash?: string;
  sellStatus: string;
  source: "live" | "history";
}

export interface WalletInfo {
  position: number;
  transferCount: number;
  firstSeen: number;
}

export interface GasCache {
  maxFeePerGas: bigint;
  maxPriorityFeePerGas: bigint;
  updatedAt: number;
}

export interface KyberCache {
  tokenAddress: string;
  encodedData: string;
  routerAddress: string;
  routeSummary: unknown;
  builtAt: number;
  balance: string;
}

export interface PrebuiltTx {
  to: string;
  data: string;
  gasLimit: bigint;
  maxFeePerGas: bigint;
  maxPriorityFeePerGas: bigint;
  type: number;
}

export interface AppSettings {
  alchemyApiKey: string;
  alchemyApiKeys: string[];
  walletPrivateKey: string;
  autoSellEnabled: boolean;
}

export type ConnectionStatus = "disconnected" | "reconnecting" | "connected";

export interface TerminalMessage {
  id: string;
  text: string;
  timestamp: Date;
}
