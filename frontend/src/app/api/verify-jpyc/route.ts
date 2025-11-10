import { NextRequest, NextResponse } from "next/server";

// JPYC社のアドレスとJPYCトークンのコントラクトアドレス
const JPYC_COMPANY_ADDRESS = "0x3fFc3f356C253eE207f7B5Fe0777f3867DBe1752";
const JPYC_TOKEN_ADDRESS = "0xE7C3D8C9a439feDe00D2600032D5dB0Be71C3c29";

// Alchemy ENDPOINT URL（APIキーが含まれている）
const ALCHEMY_ENDPOINT = process.env.ALCHEMY_ENDPOINT;

interface VerifyJPYCRequest {
  address: string;
}

/**
 * 指定されたアドレスがJPYC社からJPYCトークンを受け取ったかどうかを検証
 */
export async function POST(request: NextRequest) {
  try {
    // 環境変数のチェック
    if (!ALCHEMY_ENDPOINT) {
      return NextResponse.json(
        { error: "ALCHEMY_ENDPOINT is not configured" },
        { status: 500 }
      );
    }

    const body: VerifyJPYCRequest = await request.json();
    const { address } = body;

    // アドレスのバリデーション
    if (!address || typeof address !== "string") {
      return NextResponse.json(
        { error: "Valid address is required" },
        { status: 400 }
      );
    }

    // アドレス形式のチェック（0xで始まる42文字の16進数）
    if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
      return NextResponse.json(
        { error: "Invalid address format" },
        { status: 400 }
      );
    }

    // Alchemy APIを使ってJPYCトークンの転送履歴を取得
    // toAddress（受け取り側）が指定されたアドレスで、
    // fromAddress（送信側）がJPYC社のアドレスで、
    // contractAddressがJPYCトークンのアドレスであるものを検索
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
            category: ["erc20"],
            toAddress: address.toLowerCase(),
            fromAddress: JPYC_COMPANY_ADDRESS.toLowerCase(),
            contractAddresses: [JPYC_TOKEN_ADDRESS.toLowerCase()],
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

    type TokenTransfer = {
      value?: string;
      blockNum?: string;
      hash?: string;
      metadata?: { blockTimestamp?: string };
    };

    const transfers: TokenTransfer[] = Array.isArray(data.result?.transfers)
      ? (data.result.transfers as TokenTransfer[])
      : [];

    // 転送が見つかったかどうか
    const hasReceivedJPYC = transfers.length > 0;

    // 最新の転送情報を取得（あれば）
    const latestTransfer = transfers[0] || null;

    // 転送の総額を計算
    const totalReceived = transfers.reduce((sum: number, transfer) => {
      const value = parseFloat(transfer.value || "0");
      return sum + value;
    }, 0);

    return NextResponse.json({
      verified: hasReceivedJPYC,
      address: address,
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
      message: hasReceivedJPYC
        ? "This address has received JPYC from JPYC Company"
        : "This address has not received JPYC from JPYC Company",
    });
  } catch (error) {
    console.error("Error verifying JPYC transfer:", error);
    return NextResponse.json(
      {
        error: "Failed to verify JPYC transfer",
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
        error: "Failed to verify JPYC transfer",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
