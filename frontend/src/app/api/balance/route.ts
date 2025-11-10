import { NextRequest, NextResponse } from "next/server";
import { checkBalance } from "@/lib/checkBalance";

/**
 * 指定されたアドレスのAVAX残高を取得
 */
export async function POST(request: NextRequest) {
  try {
    const ALCHEMY_ENDPOINT = process.env.ALCHEMY_ENDPOINT;

    if (!ALCHEMY_ENDPOINT) {
      return NextResponse.json(
        { error: "ALCHEMY_ENDPOINT is not configured" },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { address } = body;

    if (!address || typeof address !== "string") {
      return NextResponse.json(
        { error: "Valid address is required" },
        { status: 400 }
      );
    }

    if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
      return NextResponse.json(
        { error: "Invalid address format" },
        { status: 400 }
      );
    }

    const balanceData = await checkBalance(address);

    return NextResponse.json({
      address: balanceData.address,
      balance: balanceData.balanceAvax,
      balanceFormatted: balanceData.balanceAvaxFormatted,
      balanceWei: balanceData.balanceWei,
    });
  } catch (error) {
    console.error("Error getting balance:", error);
    return NextResponse.json(
      {
        error: "Failed to get balance",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * GETリクエストでも動作するように（クエリパラメータで）
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const address = searchParams.get("address");

    if (!address) {
      return NextResponse.json(
        { error: "Address query parameter is required" },
        { status: 400 }
      );
    }

    // POSTと同じロジックを使用
    const body = { address };
    const req = new NextRequest(request.url, {
      method: "POST",
      body: JSON.stringify(body),
      headers: {
        "Content-Type": "application/json",
      },
    });

    return POST(req);
  } catch (error) {
    console.error("Error in GET request:", error);
    return NextResponse.json(
      {
        error: "Failed to get balance",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
