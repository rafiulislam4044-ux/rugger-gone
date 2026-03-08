import { KYBERSWAP_API, WETH_BASE } from "./constants";

export async function getKyberRoute(tokenAddress: string, amountIn: string, walletAddress: string) {
  const params = new URLSearchParams({
    tokenIn: tokenAddress,
    tokenOut: WETH_BASE,
    amountIn,
    to: walletAddress,
  });

  const res = await fetch(`${KYBERSWAP_API}/routes?${params}`, {
    headers: { "x-client-id": "rug-detector" },
  });
  const data = await res.json();
  return data.data.routeSummary;
}

export async function buildKyberSwap(
  routeSummary: unknown,
  walletAddress: string,
  deadlineSeconds = 600
) {
  const res = await fetch(`${KYBERSWAP_API}/route/build`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-client-id": "rug-detector",
    },
    body: JSON.stringify({
      routeSummary,
      sender: walletAddress,
      recipient: walletAddress,
      slippageTolerance: 2000,
      ignoreCappedSlippage: true,
      deadline: Math.floor(Date.now() / 1000) + deadlineSeconds,
    }),
  });
  const data = await res.json();
  return {
    encodedData: data.data.data,
    routerAddress: data.data.routerAddress,
  };
}
