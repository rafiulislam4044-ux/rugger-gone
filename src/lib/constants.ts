export const KYBERSWAP_ROUTER = "0x6131b5fae19ea4f9d964eac0408e4408b66337b5";
export const WETH_BASE = "0x4200000000000000000000000000000000000006";
export const KYBERSWAP_API = "https://aggregator-api.kyberswap.com/base/api/v1";
export const TRANSFER_SELECTOR = "0xa9059cbb";
export const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

export const ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
  "function name() view returns (string)",
  "function totalSupply() view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
];

export const MAX_DANGER_CARDS = 50;
export const MAX_WALLET_TRANSFERS = 5;
export const GAS_REFRESH_INTERVAL = 3000;
export const KYBER_REFRESH_INTERVAL = 30000;
export const PENDING_CLEANUP_INTERVAL = 300000;
export const WS_RECONNECT_DELAY = 2000;
