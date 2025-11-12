import { NextRequest, NextResponse } from "next/server";
import { ethers } from "ethers";
import { checkBalance } from "@/lib/checkBalance";
import { checkSenderTransfer } from "@/lib/checkSenderTransfer";

const ALCHEMY_ENDPOINT = process.env.ALCHEMY_ENDPOINT;
const SECRET_KEY = process.env.SECRET_KEY;
const SENDER_ADDRESS = process.env.ADDRESS;
const CLAIM_AMOUNT = "0.001"; // 0.001 AVAX
const DEFAULT_GAS_PRICE_GWEI = process.env.GAS_PRICE_GWEI ?? "30"; // fallback gas price

// JPYC社のアドレスとJPYCトークンのコントラクトアドレス
const JPYC_COMPANY_ADDRESS = "0x8549E82239a88f463ab6E55Ad1895b629a00Def3";
const JPYC_TOKEN_ADDRESS = "0xE7C3D8C9a439feDe00D2600032D5dB0Be71C3c29";

/**
 * claim実行用のAPIエンドポイント
 * 1. JPYC受け取り履歴をチェック
 * 2. AVAX残高が0.001以下かチェック
 * 3. ADDRESSから送信先への送信履歴をチェック
 * 4. 条件を満たしたら0.001 AVAXを送信
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

    const { address, dryRun } = body;
    const isDryRun = dryRun === true;

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

    // 1. JPYC受け取り履歴をチェック
    type TokenTransfer = {
      value?: string;
    };

    let jpycData;
    try {
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
              maxCount: "0x64",
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

      const transfers: TokenTransfer[] = Array.isArray(data.result?.transfers)
        ? (data.result.transfers as TokenTransfer[])
        : [];
      jpycData = {
        verified: transfers.length > 0,
        transfersCount: transfers.length,
        totalReceived: transfers.reduce((sum: number, transfer) => {
          return sum + parseFloat(transfer.value || "0");
        }, 0),
      };
    } catch (error) {
      return NextResponse.json(
        {
          error: "Failed to check JPYC transfer history",
          details: error instanceof Error ? error.message : "Unknown error",
        },
        { status: 500 }
      );
    }

    // JPYC受け取り履歴がない場合はclaim不可
    if (!jpycData.verified) {
      return NextResponse.json(
        {
          error: "This address has not received JPYC from JPYC Company",
          jpycTransfersCount: jpycData.transfersCount,
        },
        { status: 400 }
      );
    }

    // 2. AVAX残高をチェック（0.001 AVAX以下かどうか）
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
          error: "Address balance is above 0.001 AVAX",
          balance: balanceData.balanceAvax,
          balanceFormatted: balanceData.balanceAvaxFormatted,
        },
        { status: 400 }
      );
    }

    // 3. ADDRESSから送信先への送信履歴をチェック
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
          error: "This address has already received AVAX from the sender address",
          transfersCount: transferData.transfersCount,
        },
        { status: 400 }
      );
    }

    // 4. 0.001 AVAXを送信
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
    let gasPrice;
    let tx;
    let receipt;
    try {
      feeData = await provider.getFeeData();
      const fallbackGasPrice = ethers.parseUnits(
        DEFAULT_GAS_PRICE_GWEI,
        "gwei"
      );

      gasPrice =
        feeData.gasPrice && feeData.gasPrice > fallbackGasPrice
          ? feeData.gasPrice
          : fallbackGasPrice;

      if (isDryRun) {
        return NextResponse.json({
          success: true,
          dryRun: true,
          address,
          amount: CLAIM_AMOUNT,
          gasPrice: gasPrice.toString(),
          balanceBefore: balanceData.balanceAvax,
          senderTransferVerified: true,
        });
      }

      tx = await wallet.sendTransaction({
        to: address,
        value: amountWei,
        gasPrice,
      });

      // トランザクションを待機
      receipt = await tx.wait();
    } catch (error) {
      console.error("Failed to send transaction", {
        message: error instanceof Error ? error.message : error,
        gasPrice: gasPrice?.toString(),
        dryRun: isDryRun,
      });
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
      balanceBefore: balanceData.balanceAvax,
      senderTransferVerified: true,
    });
  } catch (error) {
    console.error("Error claiming AVAX:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    return NextResponse.json(
      {
        error: "Failed to claim AVAX",
        details: errorMessage,
        stack: process.env.NODE_ENV === "development" ? errorStack : undefined,
      },
      { status: 500 }
    );
  }
}
