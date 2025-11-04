import { NextRequest, NextResponse } from "next/server";
import { createPublicClient, http, decodeEventLog } from "viem";
import { polygon } from "viem/chains";

const ALCHEMY_ENDPOINT = process.env.ALCHEMY_ENDPOINT;
const COMMERCIAL_CONTRACT_ADDRESS =
  process.env.NEXT_PUBLIC_COMMERCIAL_CONTRACT_ADDRESS;

interface AdHistoryRequest {
  contractAddress?: string;
  erc20TokenAddress?: string; // ERC20トークンアドレス（オプション）
}

export const misstakeList = [
  {
    miss: "https://prcdn.freetls.fastly.net/release_image/46288/150/46288-150-4068449046755ead34a8b0[…]pg?format=jpeg&auto=webp&fit=bounds&width=720&height=480",
    correct:
      "https://prcdn.freetls.fastly.net/release_image/46288/150/46288-150-4068449046755ead34a8b0c5252c2b82-1280x720.jpg?width=1950&height=1350&quality=85%2C75&format=jpeg&auto=webp&fit=bounds&bg-color=fff",
  },
  {
    miss: "https://drive.google.com/file/d/1xBsNosSi2nDfnFr_CsIuQrgkJbEA8vsg/view?usp=drive_link",
    correct:
      "https://prcdn.freetls.fastly.net/release_image/46288/150/46288-150-4068449046755ead34a8b0c5252c2b82-1280x720.jpg?width=1950&height=1350&quality=85%2C75&format=jpeg&auto=webp&fit=bounds&bg-color=fff",
  }
];

/**
 * 広告オークションコントラクトの入札履歴を取得
 * Alchemy APIのalchemy_getAssetTransfersを使ってコントラクトへのERC20転送を取得
 */
export async function POST(request: NextRequest) {
  try {
    if (!ALCHEMY_ENDPOINT) {
      return NextResponse.json(
        { error: "ALCHEMY_ENDPOINT is not configured" },
        { status: 500 }
      );
    }

    let body: AdHistoryRequest = {};
    try {
      const requestBody = await request.text();
      if (requestBody) {
        body = JSON.parse(requestBody);
      }
    } catch (error) {
      // リクエストボディが空または無効なJSONの場合は空オブジェクトを使用
      console.warn("Failed to parse request body, using defaults:", error);
    }

    // コントラクトアドレスを環境変数から取得、リクエストボディからも取得可能
    const contractAddress = body.contractAddress || COMMERCIAL_CONTRACT_ADDRESS;
    let erc20TokenAddress = body.erc20TokenAddress;

    if (!contractAddress || typeof contractAddress !== "string") {
      return NextResponse.json(
        {
          error:
            "Valid contract address is required. Set NEXT_PUBLIC_COMMERCIAL_CONTRACT_ADDRESS in .env.local or pass in request body.",
        },
        { status: 400 }
      );
    }

    if (!/^0x[a-fA-F0-9]{40}$/.test(contractAddress)) {
      return NextResponse.json(
        { error: "Invalid contract address format" },
        { status: 400 }
      );
    }

    // ERC20トークンアドレスが指定されていない場合、コントラクトから取得
    if (!erc20TokenAddress) {
      const publicClient = createPublicClient({
        chain: polygon,
        transport: http(ALCHEMY_ENDPOINT),
      });

      const ERC20_TOKEN_ABI = [
        {
          inputs: [],
          name: "getERC20TokenAddress",
          outputs: [{ internalType: "address", name: "", type: "address" }],
          stateMutability: "view",
          type: "function",
        },
      ] as const;

      try {
        erc20TokenAddress = await publicClient.readContract({
          address: contractAddress as `0x${string}`,
          abi: ERC20_TOKEN_ABI,
          functionName: "getERC20TokenAddress",
        });
      } catch (error) {
        console.error(
          "Failed to get ERC20 token address from contract:",
          error
        );
        // ERC20トークンアドレスが取得できない場合は、すべてのERC20転送を取得
      }
    }

    // Alchemy APIを使ってコントラクトへのERC20転送を取得
    const params: any = {
      fromBlock: "0x0",
      toBlock: "latest",
      category: ["erc20"],
      toAddress: contractAddress.toLowerCase(),
      excludeZeroValue: true,
      maxCount: "0x3e8", // 1000 in hex
      order: "desc",
      withMetadata: true,
    };

    // ERC20トークンアドレスが指定されている場合、そのトークンのみを取得
    if (
      erc20TokenAddress &&
      erc20TokenAddress !== "0x0000000000000000000000000000000000000000"
    ) {
      params.contractAddresses = [erc20TokenAddress.toLowerCase()];
    }

    const response = await fetch(ALCHEMY_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "alchemy_getAssetTransfers",
        params: [params],
      }),
    });

    if (!response.ok) {
      throw new Error(
        `Alchemy API error: ${response.status} ${response.statusText}`
      );
    }

    const data = await response.json();

    if (data.error) {
      throw new Error(
        `Alchemy API error: ${data.error.message || JSON.stringify(data.error)}`
      );
    }

    const transfers = data.result?.transfers || [];

    // 転送履歴を整形（広告データも取得）
    const publicClient = createPublicClient({
      chain: polygon,
      transport: http(ALCHEMY_ENDPOINT),
    });

    // AdBidPlacedイベントのABI定義
    const AdBidPlacedABI = {
      name: "AdBidPlaced",
      type: "event",
      inputs: [
        { name: "bidder", type: "address", indexed: true },
        { name: "bidAmount", type: "uint256", indexed: false },
        { name: "imageUrl", type: "string", indexed: false },
        { name: "altText", type: "string", indexed: false },
        { name: "hrefUrl", type: "string", indexed: false },
      ],
    } as const;

    // 転送履歴を整形（広告データも取得）
    const history = await Promise.all(
      transfers.map(async (transfer: any) => {
        // Alchemy APIのERC20転送の場合、値はrawContract.valueに16進数文字列で含まれる
        // またはtransfer.valueに含まれる場合もある
        let value: string;

        // まずrawContract.valueを確認（ERC20の場合、通常はこちら）
        if (transfer.rawContract?.value) {
          // rawContract.valueは16進数文字列（例: "0x56bc75e2d630e0000"）
          const rawValue = transfer.rawContract.value;
          if (typeof rawValue === "string" && rawValue.startsWith("0x")) {
            value = BigInt(rawValue).toString();
          } else {
            value = rawValue.toString();
          }
        } else if (transfer.value) {
          // transfer.valueが存在する場合（フォールバック）
          if (
            typeof transfer.value === "string" &&
            transfer.value.startsWith("0x")
          ) {
            // 16進数文字列の場合
            value = BigInt(transfer.value).toString();
          } else if (typeof transfer.value === "number") {
            // 数値の場合、これはすでにフォーマットされた値の可能性がある
            // しかし、Alchemy APIのERC20転送では通常wei単位の数値文字列が返される
            // 安全のため、そのまま使用する（ただし、これは問題の原因かもしれない）
            value = transfer.value.toString();
          } else {
            // 文字列の場合
            value = transfer.value.toString();
          }
        } else {
          value = "0";
        }

        // デバッグ用ログ（JPYCの場合のみ）
        if (transfer.asset === "JPYC" || transfer.asset === "JPYD") {
          console.log("JPYC transfer value processing:", {
            rawContractValue: transfer.rawContract?.value,
            transferValue: transfer.value,
            finalValue: value,
            asset: transfer.asset,
          });
        }

        // トランザクションからAdBidPlacedイベントを取得
        let adData: {
          imageUrl?: string;
          altText?: string;
          hrefUrl?: string;
          bidAmount?: bigint;
        } = {};

        try {
          // トランザクションのログを取得
          const receipt = await publicClient.getTransactionReceipt({
            hash: transfer.hash as `0x${string}`,
          });

          // AdBidPlacedイベントを探す
          const adBidPlacedLog = receipt.logs.find((log) => {
            try {
              const decoded = decodeEventLog({
                abi: [AdBidPlacedABI],
                data: log.data,
                topics: log.topics,
              });
              return decoded.eventName === "AdBidPlaced";
            } catch {
              return false;
            }
          });

          if (adBidPlacedLog) {
            try {
              const decoded = decodeEventLog({
                abi: [AdBidPlacedABI],
                data: adBidPlacedLog.data,
                topics: adBidPlacedLog.topics,
              });
              // AdBidPlacedイベントからbidAmountを取得（これが最も正確な値）
              const bidAmount = decoded.args.bidAmount as bigint;
              adData = {
                imageUrl: decoded.args.imageUrl as string,
                altText: decoded.args.altText as string,
                hrefUrl: decoded.args.hrefUrl as string,
                bidAmount: bidAmount,
              };
              // bidAmountが取得できた場合、それを使用（より正確）
              if (bidAmount !== undefined) {
                const oldValue = value;
                value = bidAmount.toString();
                // デバッグ用ログ（JPYCの場合のみ）
                if (transfer.asset === "JPYC" || transfer.asset === "JPYD") {
                  console.log("JPYC AdBidPlaced event:", {
                    transferValue: oldValue,
                    bidAmount: bidAmount.toString(),
                    finalValue: value,
                    asset: transfer.asset,
                  });
                }
              }
            } catch (error) {
              console.error("Failed to decode AdBidPlaced event:", error);
            }
          }
        } catch (error) {
          // トランザクションが見つからない場合や、エラーが発生した場合はスキップ
          console.error(
            `Failed to get transaction receipt for ${transfer.hash}:`,
            error
          );
        }
        // 間違えているなら正しい画像URLに差し替え
        const goodimageUrl =
          misstakeList.find((item) => item.miss === adData.imageUrl)?.correct ||
          adData.imageUrl;
        console.log({ imageUrl: adData.imageUrl, goodimageUrl: goodimageUrl });

        return {
          transactionHash: transfer.hash,
          blockNumber: parseInt(transfer.blockNum, 16),
          timestamp: transfer.metadata?.blockTimestamp
            ? new Date(transfer.metadata.blockTimestamp).getTime() / 1000
            : null,
          from: transfer.from || "",
          value: value,
          tokenSymbol: transfer.asset || "Unknown",
          imageUrl: goodimageUrl,
          altText: adData.altText,
          hrefUrl: adData.hrefUrl,
        };
      })
    );

    return NextResponse.json({
      history: history.sort(
        (a: any, b: any) => (b.blockNumber || 0) - (a.blockNumber || 0)
      ),
      total: history.length,
    });
  } catch (error) {
    console.error("Error fetching ad history:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch ad history",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
