// Alchemy API key rotation — auto-cycles to next key on rate limit (429) errors

let apiKeys: string[] = [];
let currentKeyIndex = 0;
let rateLimitedKeys: Record<number, number> = {}; // index -> cooldown timestamp

const RATE_LIMIT_COOLDOWN = 5000; // 5 seconds cooldown per key

export function setApiKeys(keys: string[]) {
  apiKeys = keys.filter((k) => k.trim().length > 0);
  currentKeyIndex = 0;
  rateLimitedKeys = {};
}

export function getActiveApiKey(): string {
  if (apiKeys.length === 0) return "";
  
  const now = Date.now();
  
  // Try current key first
  if (!rateLimitedKeys[currentKeyIndex] || now > rateLimitedKeys[currentKeyIndex]) {
    delete rateLimitedKeys[currentKeyIndex];
    return apiKeys[currentKeyIndex];
  }
  
  // Current key is rate-limited — find next available
  for (let i = 0; i < apiKeys.length; i++) {
    const idx = (currentKeyIndex + i + 1) % apiKeys.length;
    if (!rateLimitedKeys[idx] || now > rateLimitedKeys[idx]) {
      delete rateLimitedKeys[idx];
      currentKeyIndex = idx;
      return apiKeys[idx];
    }
  }
  
  // All keys rate-limited — return the one with shortest cooldown
  let bestIdx = 0;
  let bestTime = Infinity;
  for (const [idx, time] of Object.entries(rateLimitedKeys)) {
    if (time < bestTime) {
      bestTime = time;
      bestIdx = Number(idx);
    }
  }
  currentKeyIndex = bestIdx;
  return apiKeys[bestIdx];
}

export function markKeyRateLimited() {
  rateLimitedKeys[currentKeyIndex] = Date.now() + RATE_LIMIT_COOLDOWN;
  // Rotate to next key immediately
  const nextIdx = (currentKeyIndex + 1) % apiKeys.length;
  currentKeyIndex = nextIdx;
}

export function getKeyCount(): number {
  return apiKeys.length;
}

export function getCurrentKeyIndex(): number {
  return currentKeyIndex;
}

export function getAllKeys(): string[] {
  return [...apiKeys];
}

// Wrapper for fetch that auto-rotates on 429
export async function alchemyFetch(
  path: string,
  options?: RequestInit
): Promise<Response> {
  const key = getActiveApiKey();
  if (!key) throw new Error("No Alchemy API keys configured");
  
  const url = `https://base-mainnet.g.alchemy.com/v2/${key}${path}`;
  const res = await fetch(url, options);
  
  if (res.status === 429) {
    markKeyRateLimited();
    // Retry with next key
    const nextKey = getActiveApiKey();
    const retryUrl = `https://base-mainnet.g.alchemy.com/v2/${nextKey}${path}`;
    return fetch(retryUrl, options);
  }
  
  return res;
}

// Get provider URL with rotation
export function getAlchemyRpcUrl(): string {
  const key = getActiveApiKey();
  return `https://base-mainnet.g.alchemy.com/v2/${key}`;
}

// Get WebSocket URL with rotation
export function getAlchemyWsUrl(): string {
  const key = getActiveApiKey();
  return `wss://base-mainnet.g.alchemy.com/v2/${key}`;
}
