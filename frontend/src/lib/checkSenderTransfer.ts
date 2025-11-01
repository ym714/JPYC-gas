const ALCHEMY_ENDPOINT = process.env.ALCHEMY_ENDPOINT;
const SENDER_ADDRESS = process.env.ADDRESS;

export interface SenderTransferData {
  verified: boolean;
  address: string;
  senderAddress: string;
  transfersCount: number;
  totalReceived: number;
  latestTransfer: {
    blockNumber: string;
    transactionHash: string;
    value: string;
    timestamp?: string;
  } | null;
  message: string;
}

/**
 * ADDRESS環境変数に登録されたアドレスから、指定されたアドレスへの送信があったかをチェック
 * JPYC検証と同じ方法
 */
export async function checkSenderTransfer(address: string): Promise<SenderTransferData> {
  if (!ALCHEMY_ENDPOINT) {
    throw new Error("ALCHEMY_ENDPOINT is not configured");
  }

  if (!SENDER_ADDRESS) {
    throw new Error("ADDRESS is not configured");
  }

  if (!address || typeof address !== "string") {
    throw new Error("Valid address is required");
  }

  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
    throw new Error("Invalid address format");
  }

  // Alchemy APIを使って送信履歴を取得
  // fromAddress（送信側）がADDRESS環境変数のアドレスで、
  // toAddress（受け取り側）が指定されたアドレスであるものを検索
  const response = await fetch(ALCHEMY_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "alchemy_getAssetTransfers",
      params: [
        {
          fromBlock: "0x0",
          toBlock: "latest",
          category: ["external"], // External transfers for native POL/MATIC
          toAddress: address.toLowerCase(),
          fromAddress: SENDER_ADDRESS.toLowerCase(),
          excludeZeroValue: true,
          maxCount: "0x64", // 100 in hex
          order: "desc",
          withMetadata: true,
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`Alchemy API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();

  if (data.error) {
    throw new Error(`Alchemy API error: ${data.error.message || JSON.stringify(data.error)}`);
  }

  const transfers = data.result?.transfers || [];
  const hasReceived = transfers.length > 0;

  const latestTransfer = transfers[0] || null;

  // 総受取額を計算
  const totalReceived = transfers.reduce((sum: number, transfer: any) => {
    const value = parseFloat(transfer.value || "0");
    return sum + value;
  }, 0);

  return {
    verified: hasReceived,
    address: address,
    senderAddress: SENDER_ADDRESS,
    transfersCount: transfers.length,
    totalReceived: totalReceived,
    latestTransfer: latestTransfer
      ? {
          blockNumber: latestTransfer.blockNum,
          transactionHash: latestTransfer.hash,
          value: latestTransfer.value,
          timestamp: latestTransfer.metadata?.blockTimestamp,
        }
      : null,
    message: hasReceived
      ? "This address has received POL from the sender address"
      : "This address has not received POL from the sender address",
  };
}

