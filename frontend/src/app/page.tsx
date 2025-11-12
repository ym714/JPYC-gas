"use client";

import { useState, useEffect } from "react";
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { Commercial, defaultCommercial } from "@/default";
import { getCurrentAd, getMinBidAmount, preparePlaceBidTransaction } from "@/lib/adContract";
import { parseEther, formatEther } from "viem";

interface VerificationResult {
  verified: boolean;
  address: string;
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

interface ClaimResult {
  success: boolean;
  address: string;
  amount: string;
  transactionHash: string;
  blockNumber?: string;
  balanceBefore: number;
  senderTransferVerified: boolean;
}

export default function Home() {
  const { address, isConnected } = useAccount();
  const polygonFaucetUrl =
    process.env.NEXT_PUBLIC_POLYGON_FAUCET_URL || "https://jpyc-volunteer.vercel.app";
  
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const [claimLoading, setClaimLoading] = useState(false);
  const [claimResult, setClaimResult] = useState<ClaimResult | null>(null);
  const [claimError, setClaimError] = useState<string | null>(null);

  // 寄付アドレスのAVAX残高
  const [donationBalance, setDonationBalance] = useState<string | null>(null);
  const [donationBalanceLoading, setDonationBalanceLoading] = useState(false);

  // 広告関連の状態
  const [commercial, setCommercial] = useState<Commercial | null>(null);
  const [adLoading, setAdLoading] = useState(false);
  const [minBidAmount, setMinBidAmount] = useState<string | null>(null);
  
  // 入札関連の状態
  const [bidImageUrl, setBidImageUrl] = useState("");
  const [bidAltText, setBidAltText] = useState("");
  const [bidHrefUrl, setBidHrefUrl] = useState("");
  const [bidAmount, setBidAmount] = useState("");
  const [showBidForm, setShowBidForm] = useState(false);

  // wagmi hooks for contract interaction
  const { writeContract, data: hash, isPending: isBidPending, error: bidError } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash,
  });

  // 寄付アドレスのAVAX残高を取得
  const DONATION_ADDRESS = "0x11101821fc4323C30bA24538d276d4eC959f200E";
  
  useEffect(() => {
    const fetchDonationBalance = async () => {
      setDonationBalanceLoading(true);
      try {
        const response = await fetch("/api/balance", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ address: DONATION_ADDRESS }),
        });

        if (response.ok) {
          const data = await response.json();
          setDonationBalance(data.balanceFormatted);
        } else {
          setDonationBalance(null);
        }
      } catch (error) {
        console.error("Failed to fetch donation balance:", error);
        setDonationBalance(null);
      } finally {
        setDonationBalanceLoading(false);
      }
    };

    fetchDonationBalance();
    // 定期リフレッシュは不要
    return () => {};
  }, []);

  // 広告データを取得（ad-history APIのcurrentフィールドを使用）
  useEffect(() => {
    const fetchAd = async () => {
      setAdLoading(true);
      try {
        const res = await fetch("https://jpyc-volunteer.vercel.app/api/pol/ad-history");
        if (res.ok) {
          const data = await res.json();
          if (data.current) {
            const current = data.current;
            
            const ad: Commercial = {
              "image-url": current.imageUrl || defaultCommercial["image-url"],
              "alt-text": current.altText || defaultCommercial["alt-text"],
              "href-url": current.hrefUrl || defaultCommercial["href-url"],
            };
            setCommercial(ad);
          } else {
            // currentが取得できない場合はデフォルト
            setCommercial(defaultCommercial);
          }
        } else {
          // APIが失敗した場合のみデフォルト
          setCommercial(defaultCommercial);
        }

        const minBid = await getMinBidAmount();
        if (minBid !== null) {
          setMinBidAmount(minBid.formatted);
        }
      } catch (error) {
        console.error("Failed to fetch ad:", error);
        setCommercial((prev) => prev ?? defaultCommercial);
      } finally {
        setAdLoading(false);
      }
    };

    fetchAd();
    // 定期リフレッシュは不要
    return () => {};
  }, []);

  // 入札が成功したら広告を再取得（ad-history APIのcurrentフィールドを使用）
  useEffect(() => {
    if (isConfirmed) {
      const fetchAd = async () => {
        try {
          const res = await fetch("https://jpyc-volunteer.vercel.app/api/pol/ad-history");
          if (res.ok) {
            const data = await res.json();
            if (data.current) {
              const current = data.current;
              
              const ad: Commercial = {
                "image-url": current.imageUrl || defaultCommercial["image-url"],
                "alt-text": current.altText || defaultCommercial["alt-text"],
                "href-url": current.hrefUrl || defaultCommercial["href-url"],
              };
              setCommercial(ad);
            }
          }
        } catch {}
        const minBid = await getMinBidAmount();
        if (minBid !== null) {
          setMinBidAmount(minBid.formatted);
        }
        setShowBidForm(false);
        setBidImageUrl("");
        setBidAltText("");
        setBidHrefUrl("");
        setBidAmount("");
      };
      fetchAd();
    }
  }, [isConfirmed]);

  // ウォレットが接続されたら自動的に検証
  useEffect(() => {
    if (isConnected && address) {
      handleVerify(address);
    } else {
      setResult(null);
      setError(null);
      setClaimResult(null);
      setClaimError(null);
    }
  }, [isConnected, address]);

  const handleVerify = async (targetAddress: string) => {
    if (!targetAddress || !/^0x[a-fA-F0-9]{40}$/.test(targetAddress)) {
      setError("有効なウォレットアドレスが必要です");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch("/api/verify-jpyc", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ address: targetAddress }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "検証に失敗しました");
      }

      const data: VerificationResult = await response.json();
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "予期しないエラーが発生しました");
    } finally {
      setLoading(false);
    }
  };


  const handleClaim = async () => {
    if (!address) {
      setClaimError("ウォレットが接続されていません");
      return;
    }

    setClaimLoading(true);
    setClaimError(null);
    setClaimResult(null);

    try {
      const response = await fetch("/api/claim", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ address }),
      });

      const data = await response.json();

      if (!response.ok) {
        // エラーの詳細を表示
        let errorMessage = data.error || "claimに失敗しました";
        if (data.details) {
          errorMessage += `: ${data.details}`;
        }
          if (data.balanceFormatted) {
          errorMessage += ` (現在の残高: ${data.balanceFormatted} AVAX)`;
        }
        if (data.transfersCount !== undefined) {
          errorMessage += ` (送信履歴: ${data.transfersCount}回)`;
        }
        setClaimError(errorMessage);
      } else {
        const claimData: ClaimResult = data;
        setClaimResult(claimData);
        
        // claim成功後、JPYC検証を再実行
        setTimeout(() => {
          handleVerify(address);
        }, 2000);
      }
    } catch (err) {
      setClaimError(err instanceof Error ? err.message : "予期しないエラーが発生しました");
    } finally {
      setClaimLoading(false);
    }
  };


  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex min-h-screen w-full max-w-4xl flex-col items-center justify-center py-16 px-8 sm:px-16">
        <div className="w-full max-w-2xl space-y-8">
          {/* ヘッダー */}
          <div className="text-center space-y-4">
            <h1 className="text-4xl font-bold leading-tight tracking-tight text-black dark:text-zinc-50 sm:text-5xl">
              JPYCユーザーのガス代支援
            </h1>
            <p className="text-lg leading-8 text-zinc-600 dark:text-zinc-400 max-w-2xl mx-auto">
              JPYCがローンチされ、JPYC社からの振込履歴があるKYC済みアドレスには、
              JPYCしか受け取れずガス代が払えずロックされる問題があります。
              このサービスは、そんな方々に少しのガス代を送って、ロックを解消するためのものです。
            </p>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Polygon版はこちら：
              <a
                href={polygonFaucetUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-1 text-blue-600 dark:text-blue-400 hover:underline"
              >
                {polygonFaucetUrl.replace(/^https?:\/\//, "")}
              </a>
            </p>
          </div>

          {/* ウォレット接続エリア */}
          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 shadow-lg border border-zinc-200 dark:border-zinc-800">
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
                ウォレットを接続
              </h2>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                MetaMaskなどのウォレットを接続して、自動的に検証を行います。
              </p>
              <div className="flex justify-center">
                <ConnectButton />
              </div>
              {isConnected && address && (
                <div className="mt-4 pt-4 border-t border-zinc-200 dark:border-zinc-800">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full bg-green-500"></div>
                      <div>
                        <p className="text-sm text-zinc-600 dark:text-zinc-400">
                          接続中: <span className="font-mono text-sm font-semibold text-zinc-900 dark:text-zinc-50">{address.slice(0, 6)}...{address.slice(-4)}</span>
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleVerify(address)}
                      disabled={loading}
                      className="px-4 py-2 text-sm rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-400 disabled:cursor-not-allowed text-white font-medium transition-colors"
                    >
                      {loading ? "確認中..." : "再検証"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 広告枠 */}
          <div className="w-full space-y-2">
            <div className="flex items-center justify-center gap-2">
              <p className="text-center text-sm text-zinc-600 dark:text-zinc-400">広告</p>
              <a
                href="https://jpyc-volunteer.vercel.app/com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline whitespace-nowrap"
              >
                広告出稿希望の方はこちらへ
              </a>
            </div>
            {commercial ? (
              <a
                href={commercial["href-url"]}
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full flex items-center justify-center bg-gray-100 dark:bg-gray-800"
              >
                <img
                  src={commercial["image-url"]}
                  alt={commercial["alt-text"]}
                  className="w-full h-auto max-h-96 object-contain"
                />
              </a>
            ) : (
              // 初回はキャッシュからのAPI結果が来るまでプレースホルダで固定高を確保しチラつきを防止
              <div className="block w-full flex items-center justify-center bg-gray-100 dark:bg-gray-800">
                <div className="w-full max-h-96 h-64 animate-pulse bg-zinc-200 dark:bg-zinc-800" />
              </div>
            )}
          </div>

          {/* Claimエリア - JPYC受け取り履歴がある場合のみ表示 */}
          {isConnected && address && result && result.verified && (
            <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 shadow-lg border border-zinc-200 dark:border-zinc-800">
              <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50 mb-4">
                ガス代を受け取る
              </h2>
              
              <div className="space-y-4">
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  JPYC社からの振込履歴があり、かつガス代が不足している場合、
                  ガス代（0.001 AVAX）を受け取ることができます。
                </p>

                {claimError && (
                  <div className="p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                    <p className="text-sm text-red-600 dark:text-red-400">{claimError}</p>
                  </div>
                )}

                {claimResult && (
                  <div className="p-4 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                    <h3 className="font-semibold text-green-700 dark:text-green-300 mb-2">
                      ガス代の送付が完了しました！
                    </h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-zinc-600 dark:text-zinc-400">送信額:</span>
                        <span className="font-semibold text-zinc-900 dark:text-zinc-50">
                          {claimResult.amount} AVAX
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-600 dark:text-zinc-400">トランザクションハッシュ:</span>
                        <a
                          href={`https://snowtrace.io/tx/${claimResult.transactionHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-mono text-xs text-blue-600 dark:text-blue-400 hover:underline"
                        >
                          {claimResult.transactionHash.slice(0, 10)}...
                          {claimResult.transactionHash.slice(-8)}
                        </a>
                      </div>
                      {claimResult.blockNumber && (
                        <div className="flex justify-between">
                          <span className="text-zinc-600 dark:text-zinc-400">ブロック番号:</span>
                          <span className="font-mono text-xs text-zinc-900 dark:text-zinc-50">
                            {claimResult.blockNumber}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {!claimResult && (
                  <button
                    onClick={handleClaim}
                    disabled={claimLoading}
                    className="w-full px-6 py-3 rounded-lg bg-green-600 hover:bg-green-700 disabled:bg-zinc-400 disabled:cursor-not-allowed text-white font-medium transition-colors"
                  >
                    {claimLoading ? "送信中..." : "ガス代を受け取る"}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* エラー表示 */}
          {error && (
            <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 shadow-lg border border-zinc-200 dark:border-zinc-800">
              <div className="p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              </div>
            </div>
          )}

          {/* 結果表示 */}
          {result && (
            <div className="bg-white dark:bg-zinc-900 rounded-2xl p-8 shadow-lg border border-zinc-200 dark:border-zinc-800 space-y-6">
              <div
                className={`p-6 rounded-lg border-2 ${
                  result.verified
                    ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800"
                    : "bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800"
                }`}
              >
                <div className="flex items-center gap-3 mb-4">
                  {result.verified ? (
                    <>
                      <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center">
                        <svg
                          className="w-5 h-5 text-white"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                      </div>
                      <h3 className="text-xl font-semibold text-green-700 dark:text-green-300">
                        JPYC受け取り履歴を確認
                      </h3>
                    </>
                  ) : (
                    <>
                      <div className="w-8 h-8 rounded-full bg-yellow-500 flex items-center justify-center">
                        <svg
                          className="w-5 h-5 text-white"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                          />
                        </svg>
                      </div>
                      <h3 className="text-xl font-semibold text-yellow-700 dark:text-yellow-300">
                        JPYC受け取り履歴が見つかりません
                      </h3>
                    </>
                  )}
                </div>
                <p className="text-sm text-zinc-700 dark:text-zinc-300 mb-4">
                  {result.message}
                </p>
              </div>

              {/* 詳細情報 */}
              <div className="space-y-3 text-sm">
                <div className="flex justify-between items-center p-3 bg-zinc-50 dark:bg-zinc-800 rounded-lg">
                  <span className="text-zinc-600 dark:text-zinc-400">検証アドレス:</span>
                  <span className="font-mono text-xs text-zinc-900 dark:text-zinc-50">
                    {result.address}
                  </span>
                </div>
                <div className="flex justify-between items-center p-3 bg-zinc-50 dark:bg-zinc-800 rounded-lg">
                  <span className="text-zinc-600 dark:text-zinc-400">転送回数:</span>
                  <span className="font-semibold text-zinc-900 dark:text-zinc-50">
                    {result.transfersCount}回
                  </span>
                </div>
                <div className="flex justify-between items-center p-3 bg-zinc-50 dark:bg-zinc-800 rounded-lg">
                  <span className="text-zinc-600 dark:text-zinc-400">総受取額:</span>
                  <span className="font-semibold text-zinc-900 dark:text-zinc-50">
                    {result.totalReceived.toLocaleString()} JPYC
                  </span>
                </div>

                {/* 最新の転送情報 */}
                {result.latestTransfer && (
                  <div className="p-4 bg-zinc-50 dark:bg-zinc-800 rounded-lg space-y-2">
                    <h4 className="font-medium text-zinc-900 dark:text-zinc-50 mb-3">
                      最新の転送情報
                    </h4>
                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between">
                        <span className="text-zinc-600 dark:text-zinc-400">トランザクションハッシュ:</span>
                        <span className="font-mono text-zinc-900 dark:text-zinc-50">
                          {result.latestTransfer.transactionHash.slice(0, 10)}...
                          {result.latestTransfer.transactionHash.slice(-8)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-600 dark:text-zinc-400">ブロック番号:</span>
                        <span className="font-mono text-zinc-900 dark:text-zinc-50">
                          {result.latestTransfer.blockNumber}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-600 dark:text-zinc-400">転送額:</span>
                        <span className="font-semibold text-zinc-900 dark:text-zinc-50">
                          {parseFloat(result.latestTransfer.value).toLocaleString()} JPYC
                        </span>
                      </div>
                      {result.latestTransfer.timestamp && (
                        <div className="flex justify-between">
                          <span className="text-zinc-600 dark:text-zinc-400">タイムスタンプ:</span>
                          <span className="text-zinc-900 dark:text-zinc-50">
                            {new Date(result.latestTransfer.timestamp).toLocaleString("ja-JP")}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* フッター情報 */}
          <div className="text-center text-sm text-zinc-500 dark:text-zinc-500 space-y-2">
            <p>JPYC社アドレス: 0x8549E82239a88f463ab6E55Ad1895b629a00Def3</p>
            <p>JPYCトークン: 0xE7C3D8C9a439feDe00D2600032D5dB0Be71C3c29</p>
            <p>ネットワーク: Avalanche Mainnet (C-Chain)</p>
          </div>

          {/* 寄付情報 */}
          <div className="text-center text-sm text-zinc-600 dark:text-zinc-400 space-y-2 mt-6 pt-6 border-t border-zinc-200 dark:border-zinc-800">
            <p className="font-medium text-zinc-700 dark:text-zinc-300">
              もしこの活動に参加していただける方はこのアドレスに寄付をお願いします。ネイティブトークンAVAXを送ってください。
            </p>
            <p className="font-mono text-xs text-blue-600 dark:text-blue-400 break-all">
              0x11101821fc4323C30bA24538d276d4eC959f200E
              {donationBalance !== null && (
                <span className="ml-2 text-zinc-700 dark:text-zinc-300 font-medium">
                  ({donationBalanceLoading ? "読み込み中..." : `${donationBalance} AVAX`})
                </span>
              )}
            </p>
            <a
              href={`https://snowtrace.io/address/0x11101821fc4323C30bA24538d276d4eC959f200E`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block text-xs text-blue-600 dark:text-blue-400 hover:underline"
            >
              Snowtraceで確認
            </a>
          </div>
        </div>
      </main>
    </div>
  );
}
