const ALCHEMY_ENDPOINT = process.env.ALCHEMY_ENDPOINT;

export interface BalanceData {
  address: string;
  balanceWei: string;
  balanceMatic: number;
  balanceMaticFormatted: string;
  eligible: boolean;
}

/**
 * アドレスのPOL（MATIC）残高をチェック
 */
export async function checkBalance(address: string): Promise<BalanceData> {
  if (!ALCHEMY_ENDPOINT) {
    throw new Error("ALCHEMY_ENDPOINT is not configured");
  }

  if (!address || typeof address !== "string") {
    throw new Error("Valid address is required");
  }

  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
    throw new Error("Invalid address format");
  }

  // Alchemy APIで残高を取得
  const response = await fetch(ALCHEMY_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "eth_getBalance",
      params: [address.toLowerCase(), "latest"],
    }),
  });

  if (!response.ok) {
    throw new Error(`Alchemy API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();

  if (data.error) {
    throw new Error(`Alchemy API error: ${data.error.message || JSON.stringify(data.error)}`);
  }

  // WeiからMATICに変換（1 MATIC = 10^18 Wei）
  const balanceWei = BigInt(data.result || "0x0");
  const balanceMatic = Number(balanceWei) / 1e18;

  return {
    address: address,
    balanceWei: balanceWei.toString(),
    balanceMatic: balanceMatic,
    balanceMaticFormatted: balanceMatic.toFixed(6),
    eligible: balanceMatic <= 0.02, // 0.02 POL以下の場合にclaim可能
  };
}

