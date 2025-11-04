import { Address, createPublicClient, http, formatUnits, encodeFunctionData } from "viem";
import { polygon } from "viem/chains";
import { Commercial } from "@/default";

// AdAuctionコントラクトのABI
const AD_AUCTION_ABI = [
  {
    inputs: [],
    name: "getCurrentAd",
    outputs: [
      { internalType: "address", name: "bidder", type: "address" },
      { internalType: "uint256", name: "bidAmount", type: "uint256" },
      { internalType: "string", name: "imageUrl", type: "string" },
      { internalType: "string", name: "altText", type: "string" },
      { internalType: "string", name: "hrefUrl", type: "string" },
      { internalType: "uint256", name: "timestamp", type: "uint256" },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "getMinBidAmount",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { internalType: "string", name: "imageUrl", type: "string" },
      { internalType: "string", name: "altText", type: "string" },
      { internalType: "string", name: "hrefUrl", type: "string" },
      { internalType: "uint256", name: "bidAmount", type: "uint256" },
    ],
    name: "placeBid",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "getERC20TokenAddress",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "getDonationAddress",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "owner",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "getTokenSymbol",
    outputs: [{ internalType: "string", name: "", type: "string" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "getTokenDecimals",
    outputs: [{ internalType: "uint8", name: "", type: "uint8" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "getBalance",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

// コントラクトアドレス（環境変数から取得）
const AD_AUCTION_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_COMMERCIAL_CONTRACT_ADDRESS as Address | undefined;

// Public clientを作成
const publicClient = createPublicClient({
  chain: polygon,
  transport: http(),
});

/**
 * トークンのシンボルとdecimalsを取得
 */
export async function getTokenInfo(): Promise<{ symbol: string; decimals: number } | null> {
  if (!AD_AUCTION_CONTRACT_ADDRESS) {
    return null;
  }

  try {
    const [symbol, decimals] = await Promise.all([
      publicClient.readContract({
        address: AD_AUCTION_CONTRACT_ADDRESS,
        abi: AD_AUCTION_ABI,
        functionName: "getTokenSymbol",
      }),
      publicClient.readContract({
        address: AD_AUCTION_CONTRACT_ADDRESS,
        abi: AD_AUCTION_ABI,
        functionName: "getTokenDecimals",
      }),
    ]);

    return {
      symbol: symbol as string,
      decimals: Number(decimals),
    };
  } catch (error) {
    console.error("Failed to fetch token info:", error);
    return { symbol: "POL", decimals: 18 }; // フォールバック
  }
}

/**
 * コントラクトから現在の広告データを取得
 */
export async function getCurrentAd(): Promise<Commercial | null> {
  if (!AD_AUCTION_CONTRACT_ADDRESS) {
    console.warn("Commercial contract address not set. Please set NEXT_PUBLIC_COMMERCIAL_CONTRACT_ADDRESS in .env.local");
    return null;
  }

  try {
    // トークン情報はフォーマットに必要
    const tokenInfoPromise = getTokenInfo();

    // サーバーAPIの履歴（最新が先頭）から現在広告相当を取得
    const res = await fetch("/api/ad-history", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contractAddress: AD_AUCTION_CONTRACT_ADDRESS }),
    });
    if (!res.ok) {
      throw new Error(`ad-history api failed: ${res.status}`);
    }
    const data = await res.json();
    const history = (data?.history || []) as Array<{
      from: string;
      value: string;
      imageUrl?: string;
      altText?: string;
      hrefUrl?: string;
      timestamp?: number | null;
    }>;
    if (!history.length) {
      return null;
    }
    const latest = history[0];

    const tokenInfo = await tokenInfoPromise;
    const decimals = tokenInfo?.decimals ?? 18;

    return {
      bidder: latest.from,
      bidAmount: formatUnits(BigInt(latest.value || "0"), decimals),
      "image-url": latest.imageUrl || "",
      "alt-text": latest.altText || "",
      "href-url": latest.hrefUrl || "#",
      timestamp: latest.timestamp ? Number(latest.timestamp) : 0,
    };
  } catch (error) {
    console.error("Failed to fetch ad from history:", error);
    return null;
  }
}

/**
 * 最小入札金額を取得
 */
export async function getMinBidAmount(): Promise<{ amount: bigint; formatted: string; symbol: string } | null> {
  if (!AD_AUCTION_CONTRACT_ADDRESS) {
    return null;
  }

  try {
    const [amount, tokenInfo] = await Promise.all([
      publicClient.readContract({
        address: AD_AUCTION_CONTRACT_ADDRESS,
        abi: AD_AUCTION_ABI,
        functionName: "getMinBidAmount",
      }),
      getTokenInfo(),
    ]);

    const decimals = tokenInfo?.decimals || 18;
    const symbol = tokenInfo?.symbol || "POL";

    return {
      amount: amount as bigint,
      formatted: formatUnits(amount as bigint, decimals),
      symbol: symbol,
    };
  } catch (error) {
    console.error("Failed to fetch min bid amount:", error);
    return null;
  }
}

/**
 * 広告に入札するためのトランザクションを準備
 */
export function preparePlaceBidTransaction(
  imageUrl: string,
  altText: string,
  hrefUrl: string,
  value: bigint
) {
  if (!AD_AUCTION_CONTRACT_ADDRESS) {
    throw new Error("Commercial contract address not set. Please set NEXT_PUBLIC_COMMERCIAL_CONTRACT_ADDRESS in .env.local");
  }

  return {
    to: AD_AUCTION_CONTRACT_ADDRESS,
    value: value,
    data: encodeFunctionData({
      abi: AD_AUCTION_ABI,
      functionName: "placeBid",
      args: [imageUrl, altText, hrefUrl, value],
    }),
  };
}

