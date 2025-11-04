import { NextResponse } from "next/server";
import { createPublicClient, http } from "viem";
import { polygon } from "viem/chains";

const ALCHEMY_ENDPOINT = process.env.ALCHEMY_ENDPOINT;
const AD_AUCTION_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_COMMERCIAL_CONTRACT_ADDRESS as `0x${string}` | undefined;

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
] as const;

export async function GET() {
  try {
    if (!ALCHEMY_ENDPOINT) {
      return NextResponse.json({ error: "ALCHEMY_ENDPOINT is not configured" }, { status: 500 });
    }
    if (!AD_AUCTION_CONTRACT_ADDRESS) {
      return NextResponse.json({ error: "NEXT_PUBLIC_COMMERCIAL_CONTRACT_ADDRESS is not configured" }, { status: 500 });
    }

    const client = createPublicClient({ chain: polygon, transport: http(ALCHEMY_ENDPOINT) });
    const result = await client.readContract({
      address: AD_AUCTION_CONTRACT_ADDRESS,
      abi: AD_AUCTION_ABI,
      functionName: "getCurrentAd",
    });

    const [bidder, bidAmount, imageUrl, altText, hrefUrl, timestamp] = result as unknown as [
      string,
      bigint,
      string,
      string,
      string,
      bigint
    ];

    const data = {
      bidder,
      bidAmount: bidAmount.toString(),
      "image-url": imageUrl,
      "alt-text": altText,
      "href-url": hrefUrl,
      timestamp: Number(timestamp),
    };

    const headers: Record<string, string> = {
      // CDN/Edge キャッシュ + SWR でチラつきを抑制
      "Cache-Control": "public, s-maxage=30, stale-while-revalidate=300",
      "CDN-Cache-Control": "public, s-maxage=30, stale-while-revalidate=300",
      "Vercel-CDN-Cache-Control": "public, s-maxage=30, stale-while-revalidate=300",
    };

    return NextResponse.json(data, { headers });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch current ad", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}


