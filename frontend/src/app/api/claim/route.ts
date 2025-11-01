import { NextRequest, NextResponse } from "next/server";
import { ethers } from "ethers";
import { checkBalance } from "@/lib/checkBalance";
import { checkSenderTransfer } from "@/lib/checkSenderTransfer";

const ALCHEMY_ENDPOINT = process.env.ALCHEMY_ENDPOINT;
const SECRET_KEY = process.env.SECRET_KEY;
const SENDER_ADDRESS = process.env.ADDRESS;
const CLAIM_AMOUNT = "0.02"; // 0.02 POL

/**
 * claim実行用のAPIエンドポイント
 * 1. POL残高が0.02以下かチェック
 * 2. ADDRESSから送信先への送信履歴をチェック
 * 3. 条件を満たしたら0.02 POLを送信
 */
export async function POST(request: NextRequest) {
  try {
    if (!ALCHEMY_ENDPOINT) {
      return NextResponse.json(
        { error: "ALCHEMY_ENDPOINT is not configured" },
        { status: 500 }
      );
    }

    if (!SECRET_KEY) {
      return NextResponse.json(
        { error: "SECRET_KEY is not configured" },
        { status: 500 }
      );
    }

    if (!SENDER_ADDRESS) {
      return NextResponse.json(
        { error: "ADDRESS is not configured" },
        { status: 500 }
      );
    }

    let body;
    try {
      body = await request.json();
    } catch (error) {
      return NextResponse.json(
        {
          error: "Invalid JSON in request body",
          details: error instanceof Error ? error.message : "Unknown error",
        },
        { status: 400 }
      );
    }

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

    // 1. POL残高をチェック（0.02 POL以下かどうか）
    let balanceData;
    try {
      balanceData = await checkBalance(address);
    } catch (error) {
      return NextResponse.json(
        {
          error: "Failed to check balance",
          details: error instanceof Error ? error.message : "Unknown error",
        },
        { status: 500 }
      );
    }

    if (!balanceData.eligible) {
      return NextResponse.json(
        {
          error: "Address balance is above 0.02 POL",
          balance: balanceData.balanceMatic,
          balanceFormatted: balanceData.balanceMaticFormatted,
        },
        { status: 400 }
      );
    }

    // 2. ADDRESSから送信先への送信履歴をチェック
    let transferData;
    try {
      transferData = await checkSenderTransfer(address);
    } catch (error) {
      return NextResponse.json(
        {
          error: "Failed to check transfer history",
          details: error instanceof Error ? error.message : "Unknown error",
        },
        { status: 500 }
      );
    }

    // 既に送信履歴がある場合はclaim済み
    if (transferData.verified && transferData.transfersCount > 0) {
      return NextResponse.json(
        {
          error: "This address has already received POL from the sender address",
          transfersCount: transferData.transfersCount,
        },
        { status: 400 }
      );
    }

    // 3. 0.02 POLを送信
    let provider;
    let wallet;
    try {
      provider = new ethers.JsonRpcProvider(ALCHEMY_ENDPOINT);
      wallet = new ethers.Wallet(SECRET_KEY, provider);
    } catch (error) {
      return NextResponse.json(
        {
          error: "Failed to initialize provider or wallet",
          details: error instanceof Error ? error.message : "Unknown error",
        },
        { status: 500 }
      );
    }

    // 送信アドレスがウォレットアドレスと一致するか確認
    if (wallet.address.toLowerCase() !== SENDER_ADDRESS.toLowerCase()) {
      return NextResponse.json(
        {
          error: "SECRET_KEY address does not match ADDRESS",
          walletAddress: wallet.address,
          senderAddress: SENDER_ADDRESS,
        },
        { status: 500 }
      );
    }

    let amountWei;
    try {
      amountWei = ethers.parseEther(CLAIM_AMOUNT);
    } catch (error) {
      return NextResponse.json(
        {
          error: "Failed to parse amount",
          details: error instanceof Error ? error.message : "Unknown error",
        },
        { status: 500 }
      );
    }

    // ガス価格とガスリミットを取得
    let feeData;
    let tx;
    let receipt;
    try {
      feeData = await provider.getFeeData();

      tx = await wallet.sendTransaction({
        to: address,
        value: amountWei,
        gasPrice: feeData.gasPrice,
      });

      // トランザクションを待機
      receipt = await tx.wait();
    } catch (error) {
      return NextResponse.json(
        {
          error: "Failed to send transaction",
          details: error instanceof Error ? error.message : "Unknown error",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      address: address,
      amount: CLAIM_AMOUNT,
      transactionHash: receipt?.hash || tx.hash,
      blockNumber: receipt?.blockNumber?.toString(),
      balanceBefore: balanceData.balanceMatic,
      senderTransferVerified: true,
    });
  } catch (error) {
    console.error("Error claiming POL:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    return NextResponse.json(
      {
        error: "Failed to claim POL",
        details: errorMessage,
        stack: process.env.NODE_ENV === "development" ? errorStack : undefined,
      },
      { status: 500 }
    );
  }
}
