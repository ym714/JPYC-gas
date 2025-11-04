"use client";

import { useState, useEffect } from "react";
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { Commercial } from "@/default";
import { getCurrentAd, getMinBidAmount, getTokenInfo } from "@/lib/adContract";
import { parseEther, formatEther, Address, formatUnits, parseUnits, createPublicClient, http } from "viem";
import { polygon } from "viem/chains";

// コントラクトアドレス
const COMMERCIAL_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_COMMERCIAL_CONTRACT_ADDRESS as Address | undefined;

// JPYCトークンアドレス
const JPYC_TOKEN_ADDRESS = "0xE7C3D8C9a439feDe00D2600032D5dB0Be71C3c29" as Address;

// Public clientを作成
const publicClient = createPublicClient({
  chain: polygon,
  transport: http(),
});

// ERC20標準のABI（decimals関数用）
const ERC20_ABI = [
  {
    inputs: [],
    name: "decimals",
    outputs: [{ internalType: "uint8", name: "", type: "uint8" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

// JPYCトークンのdecimalsを取得する関数
async function getJPYCDecimals(): Promise<number> {
  try {
    const decimals = await publicClient.readContract({
      address: JPYC_TOKEN_ADDRESS,
      abi: ERC20_ABI,
      functionName: "decimals",
    });
    const decimalsNum = Number(decimals);
    console.log("JPYC decimals from contract:", decimalsNum);
    return decimalsNum;
  } catch (error) {
    console.error("Failed to get JPYC decimals, using default 18:", error);
    // JPYCトークンは18 decimals
    return 18;
  }
}

// ABI
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
    name: "owner",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "view",
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
    name: "getBalance",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

interface BidHistory {
  transactionHash: string;
  blockNumber: number;
  timestamp: number | null;
  from: string;
  value: string;
  tokenSymbol?: string;
  imageUrl?: string;
  altText?: string;
  hrefUrl?: string;
}

export default function ComPage() {
  const { address, isConnected } = useAccount();
  
  // 広告関連の状態
  const [commercial, setCommercial] = useState<Commercial | null>(null);
  const [adLoading, setAdLoading] = useState(false);
  const [minBidAmount, setMinBidAmount] = useState<{ amount: bigint; formatted: string; symbol: string } | null>(null);
  const [tokenSymbol, setTokenSymbol] = useState<string>("POL");
  const [tokenDecimals, setTokenDecimals] = useState<number>(18);
  const [jpycDecimals, setJpycDecimals] = useState<number>(18); // JPYCのdecimals（18 decimals）
  
  // 入札関連の状態
  const [bidImageUrl, setBidImageUrl] = useState("");
  const [bidAltText, setBidAltText] = useState("");
  const [bidHrefUrl, setBidHrefUrl] = useState("");
  const [bidAmount, setBidAmount] = useState("");
  
  // approve完了後にplaceBidを実行するための一時保存
  const [pendingBidData, setPendingBidData] = useState<{
    imageUrl: string;
    altText: string;
    hrefUrl: string;
    amount: string;
    amountWei: bigint;
  } | null>(null);

  // 履歴関連の状態
  const [history, setHistory] = useState<BidHistory[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);


  // wagmi hooks
  const { writeContract, data: hash, isPending: isBidPending, error: bidError } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash,
  });

  // approve用のhooks
  const { writeContract: writeApproveContract, data: approveHash, isPending: isApprovePending } = useWriteContract();
  const { isLoading: isApproveConfirming, isSuccess: isApproveConfirmed } = useWaitForTransactionReceipt({
    hash: approveHash,
  });


  // 広告データを取得
  useEffect(() => {
    const fetchAd = async () => {
      if (!COMMERCIAL_CONTRACT_ADDRESS) return;
      
      setAdLoading(true);
      try {
        const [ad, minBid, tokenInfo, jpycDec] = await Promise.all([
          getCurrentAd(),
          getMinBidAmount(),
          getTokenInfo(),
          getJPYCDecimals(),
        ]);

        if (ad) {
          setCommercial(ad);
        }

        if (minBid !== null) {
          setMinBidAmount(minBid);
        }

        if (tokenInfo) {
          setTokenSymbol(tokenInfo.symbol);
          setTokenDecimals(tokenInfo.decimals);
        }

        setJpycDecimals(jpycDec);
      } catch (error) {
        console.error("Failed to fetch ad:", error);
      } finally {
        setAdLoading(false);
      }
    };

    fetchAd();
    const interval = setInterval(fetchAd, 30000); // 30秒ごとに更新
    return () => clearInterval(interval);
  }, []);

  // 履歴を取得
  const fetchHistory = async () => {
    if (!COMMERCIAL_CONTRACT_ADDRESS) return;
    
    setHistoryLoading(true);
    try {
      // ERC20トークンアドレスも取得して渡す
      let erc20TokenAddress: string | undefined;
      try {
        const tokenAddress = await publicClient.readContract({
          address: COMMERCIAL_CONTRACT_ADDRESS,
          abi: AD_AUCTION_ABI,
          functionName: "getERC20TokenAddress",
        });
        erc20TokenAddress = tokenAddress as string;
      } catch (error) {
        console.error("Failed to get ERC20 token address:", error);
      }

      const response = await fetch("/api/ad-history", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contractAddress: COMMERCIAL_CONTRACT_ADDRESS,
          erc20TokenAddress: erc20TokenAddress,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setHistory(data.history || []);
      } else {
        const errorData = await response.json();
        console.error("Failed to fetch history:", errorData);
      }
    } catch (error) {
      console.error("Failed to fetch history:", error);
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
    const interval = setInterval(fetchHistory, 60000); // 1分ごとに更新
    return () => clearInterval(interval);
  }, []);

  // 入札が成功したら広告を再取得
  useEffect(() => {
    if (isConfirmed) {
      const fetchAd = async () => {
        const ad = await getCurrentAd();
        if (ad) {
          setCommercial(ad);
        }
        const minBid = await getMinBidAmount();
        if (minBid !== null) {
          setMinBidAmount(minBid);
        }
        setBidImageUrl("");
        setBidAltText("");
        setBidHrefUrl("");
        setBidAmount("");
        fetchHistory(); // 履歴も更新
      };
      fetchAd();
    }
  }, [isConfirmed]);

  // approveが完了したらplaceBidを実行
  useEffect(() => {
    console.log("useEffect for approve check:", {
      isApproveConfirmed,
      approveHash,
      pendingBidData: pendingBidData ? "exists" : "null",
    });

    if (isApproveConfirmed && approveHash && pendingBidData) {
      console.log("Approving confirmed, executing placeBid...", pendingBidData);
      writeContract({
        address: COMMERCIAL_CONTRACT_ADDRESS!,
        abi: AD_AUCTION_ABI,
        functionName: "placeBid",
        args: [
          pendingBidData.imageUrl,
          pendingBidData.altText,
          pendingBidData.hrefUrl,
          pendingBidData.amountWei,
        ],
      });
      // 一時データをクリア
      setPendingBidData(null);
    }
  }, [isApproveConfirmed, approveHash, pendingBidData, COMMERCIAL_CONTRACT_ADDRESS, writeContract]);

  const handlePlaceBid = async () => {
    if (!COMMERCIAL_CONTRACT_ADDRESS || !address) return;
    if (!bidImageUrl || !bidAltText || !bidHrefUrl || !bidAmount) {
      alert("すべての項目を入力してください");
      return;
    }

    const bidAmountWei = parseUnits(bidAmount, tokenDecimals);
    
    // 最小入札額チェック（100トークン単位以上）
    const minBidInTokens = BigInt(100) * BigInt(10 ** tokenDecimals);
    if (bidAmountWei < minBidInTokens) {
      alert(`入札額は100 ${tokenSymbol}以上である必要があります`);
      return;
    }

    // 現在の最小入札額より高いかチェック
    if (minBidAmount !== null && bidAmountWei < minBidAmount.amount) {
      alert(`入札額は${minBidAmount.formatted} ${minBidAmount.symbol}以上である必要があります`);
      return;
    }

    try {
      // まずERC20トークンアドレスを取得
      const erc20TokenAddress = await publicClient.readContract({
        address: COMMERCIAL_CONTRACT_ADDRESS,
        abi: AD_AUCTION_ABI,
        functionName: "getERC20TokenAddress",
      });

      if (!erc20TokenAddress || erc20TokenAddress === "0x0000000000000000000000000000000000000000") {
        alert("ERC20トークンアドレスが設定されていません");
        return;
      }

      // ERC20トークンのapproveを実行
      const ERC20_ABI = [
        {
          inputs: [
            { internalType: "address", name: "spender", type: "address" },
            { internalType: "uint256", name: "amount", type: "uint256" },
          ],
          name: "approve",
          outputs: [{ internalType: "bool", name: "", type: "bool" }],
          stateMutability: "nonpayable",
          type: "function",
        },
      ] as const;

      // 入札データを一時保存
      const bidData = {
        imageUrl: bidImageUrl,
        altText: bidAltText,
        hrefUrl: bidHrefUrl,
        amount: bidAmount,
        amountWei: bidAmountWei,
      };
      console.log("Setting pending bid data:", bidData);
      setPendingBidData(bidData);

      // approveを実行
      console.log("Executing approve...", {
        erc20TokenAddress,
        COMMERCIAL_CONTRACT_ADDRESS,
        bidAmountWei: bidAmountWei.toString(),
      });
      writeApproveContract({
        address: erc20TokenAddress as Address,
        abi: ERC20_ABI,
        functionName: "approve",
        args: [COMMERCIAL_CONTRACT_ADDRESS, bidAmountWei],
      });
    } catch (error) {
      console.error("Failed to place bid:", error);
      alert("入札に失敗しました");
    }
  };


  if (!COMMERCIAL_CONTRACT_ADDRESS) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-black">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 dark:text-red-400">
            コントラクトアドレスが設定されていません
          </h1>
          <p className="mt-4 text-zinc-600 dark:text-zinc-400">
            NEXT_PUBLIC_COMMERCIAL_CONTRACT_ADDRESSを設定してください
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex min-h-screen w-full max-w-6xl flex-col py-16 px-8 sm:px-16">
        <div className="w-full space-y-8">
          {/* ヘッダー */}
          <div className="text-center space-y-4">
            <h1 className="text-4xl font-bold leading-tight tracking-tight text-black dark:text-zinc-50 sm:text-5xl">
              広告オークション
            </h1>
            <p className="text-lg leading-8 text-zinc-600 dark:text-zinc-400 max-w-2xl mx-auto">
              現在の広告枠よりも100 {tokenSymbol}以上高い金額で入札すると、あなたの広告が表示されます。
            </p>
          </div>

          {/* ウォレット接続 */}
          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 shadow-lg border border-zinc-200 dark:border-zinc-800">
            <div className="flex justify-center">
              <ConnectButton />
            </div>
          </div>

          {/* 現在の広告 */}
          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 shadow-lg border border-zinc-200 dark:border-zinc-800">
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50 mb-4">
              現在表示中の広告
            </h2>
            {adLoading ? (
              <div className="text-center py-8">読み込み中...</div>
            ) : commercial ? (
              <div className="space-y-4">
                <a
                  href={commercial["href-url"]}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full"
                >
                  <img
                    src={commercial["image-url"]}
                    alt={commercial["alt-text"]}
                    className="w-full h-auto max-h-96 object-contain rounded-lg"
                  />
                </a>
                <div className="text-sm text-zinc-600 dark:text-zinc-400 space-y-1">
                  <p>入札者: {commercial.bidder || "初期広告"}</p>
                  {commercial.bidAmount && <p>入札額: {commercial.bidAmount} {tokenSymbol}</p>}
                  {minBidAmount !== null && (
                    <p className="font-semibold text-zinc-900 dark:text-zinc-50">
                      次の最小入札額: {minBidAmount.formatted} {minBidAmount.symbol}
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-zinc-600 dark:text-zinc-400">
                広告データを取得できませんでした
              </div>
            )}
          </div>

          {/* 入札フォーム */}
          {isConnected && (
            <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 shadow-lg border border-zinc-200 dark:border-zinc-800">
              <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50 mb-4">
                広告に入札
              </h2>

              <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                      画像URL
                    </label>
                    <input
                      type="text"
                      value={bidImageUrl}
                      onChange={(e) => setBidImageUrl(e.target.value)}
                      className="w-full px-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50"
                      placeholder="https://example.com/image.png"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                      Alt テキスト
                    </label>
                    <input
                      type="text"
                      value={bidAltText}
                      onChange={(e) => setBidAltText(e.target.value)}
                      className="w-full px-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50"
                      placeholder="広告の説明"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                      リンクURL
                    </label>
                    <input
                      type="text"
                      value={bidHrefUrl}
                      onChange={(e) => setBidHrefUrl(e.target.value)}
                      className="w-full px-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50"
                      placeholder="https://example.com"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                      入札額 ({minBidAmount?.symbol || tokenSymbol}) {minBidAmount !== null && `(最小: ${minBidAmount.formatted} ${minBidAmount.symbol})`}
                    </label>
                    <input
                      type="number"
                      step="0.000000000000000001"
                      value={bidAmount}
                      onChange={(e) => setBidAmount(e.target.value)}
                      className="w-full px-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50"
                      placeholder={minBidAmount ? `最小 ${minBidAmount.formatted} ${minBidAmount.symbol}` : `最小 0 ${tokenSymbol}`}
                      min={minBidAmount ? minBidAmount.formatted : "0"}
                    />
                    <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-500">
                      入札額は100 {tokenSymbol}以上である必要があります
                    </p>
                  </div>
                  {bidError && (
                    <div className="p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                      <p className="text-sm text-red-600 dark:text-red-400">
                        エラー: {bidError.message}
                      </p>
                    </div>
                  )}
                  <button
                    onClick={handlePlaceBid}
                    disabled={isBidPending || isConfirming}
                    className="w-full px-6 py-3 rounded-lg bg-green-600 hover:bg-green-700 disabled:bg-zinc-400 disabled:cursor-not-allowed text-white font-medium transition-colors"
                  >
                    {isBidPending || isConfirming
                      ? "処理中..."
                      : "入札する"}
                  </button>
                  {isConfirmed && (
                    <div className="p-4 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                      <p className="text-sm text-green-600 dark:text-green-400">
                        入札が完了しました！
                      </p>
                    </div>
                  )}
                </div>
            </div>
          )}


          {/* 入札履歴 */}
          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 shadow-lg border border-zinc-200 dark:border-zinc-800">
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50 mb-4">
              入札履歴
            </h2>
            {historyLoading ? (
              <div className="text-center py-8">読み込み中...</div>
            ) : history.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b border-zinc-200 dark:border-zinc-700">
                      <th className="text-left p-3 text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                        時刻
                      </th>
                      <th className="text-left p-3 text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                        送信者
                      </th>
                      <th className="text-left p-3 text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                        広告
                      </th>
                      <th className="text-right p-3 text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                        金額
                      </th>
                      <th className="text-right p-3 text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                        詳細
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((item, index) => (
                      <tr
                        key={index}
                        className="border-b border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                      >
                        <td className="p-3 text-sm text-zinc-600 dark:text-zinc-400">
                          {item.timestamp
                            ? new Date(item.timestamp * 1000).toLocaleString("ja-JP")
                            : "-"}
                        </td>
                        <td className="p-3 text-sm font-mono text-zinc-900 dark:text-zinc-50">
                          {item.from.slice(0, 6)}...{item.from.slice(-4)}
                        </td>
                        <td className="p-3 text-sm text-zinc-900 dark:text-zinc-50">
                          {item.imageUrl ? (
                            <div className="flex items-center gap-2">
                              <a
                                href={item.hrefUrl || "#"}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block"
                              >
                                <img
                                  src={item.imageUrl}
                                  alt={item.altText || ""}
                                  className="w-16 h-16 object-contain rounded"
                                />
                              </a>
                              <div className="flex flex-col">
                                <span className="text-xs text-zinc-600 dark:text-zinc-400">
                                  {item.altText || "-"}
                                </span>
                                {item.hrefUrl && (
                                  <a
                                    href={item.hrefUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline truncate max-w-[200px]"
                                  >
                                    {item.hrefUrl}
                                  </a>
                                )}
                              </div>
                            </div>
                          ) : (
                            <span className="text-zinc-400 dark:text-zinc-500">-</span>
                          )}
                        </td>
                        <td className="p-3 text-sm text-right text-zinc-900 dark:text-zinc-50">
                          {(() => {
                            try {
                              // valueをBigIntに変換して、適切なdecimalsでフォーマット
                              const valueBigInt = BigInt(item.value || "0");
                              // JPYCの場合は実際のdecimalsを使用（Polygonでは通常6）
                              const decimals = item.tokenSymbol === "JPYC" ? jpycDecimals : tokenDecimals;
                              const formatted = formatUnits(valueBigInt, decimals);
                              // デバッグ用ログ
                              if (item.tokenSymbol === "JPYC") {
                                console.log("JPYC value formatting:", {
                                  rawValue: item.value,
                                  valueBigInt: valueBigInt.toString(),
                                  decimals: decimals,
                                  jpycDecimals: jpycDecimals,
                                  formatted: formatted,
                                });
                              }
                              // formatUnitsが返す文字列から、小数点以下の末尾の不要な0を削除
                              // 例: "0.000000000000000100" -> "0.0000000000000001"
                              // 例: "100.000000000000000000" -> "100"
                              // 小数点がある場合のみ、小数点以下の末尾の0を削除
                              if (formatted.includes(".")) {
                                return formatted.replace(/\.?0+$/, "");
                              }
                              // 小数点がない場合はそのまま返す
                              return formatted;
                            } catch (error) {
                              console.error("Error formatting value:", error, item.value);
                              return item.value || "0";
                            }
                          })()}{" "}
                          {item.tokenSymbol || tokenSymbol}
                        </td>
                        <td className="p-3 text-right">
                          <a
                            href={`https://polygonscan.com/tx/${item.transactionHash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                          >
                            詳細
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-8 text-zinc-600 dark:text-zinc-400">
                履歴がありません
              </div>
            )}
          </div>

          {/* 免責事項 */}
          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 shadow-lg border border-zinc-200 dark:border-zinc-800">
            <div className="space-y-2 text-sm text-zinc-600 dark:text-zinc-400">
              <p className="font-semibold text-zinc-900 dark:text-zinc-50 mb-2">免責事項</p>
              <p>
                寄付はこのプロジェクトの存続のため、ガス代のために使われます。
              </p>
              <p>
                このプロジェクトは予告なく終了する可能性があります。
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

