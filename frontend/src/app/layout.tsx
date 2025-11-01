import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "JPYCユーザーのガス代支援",
  description:
    "JPYCしか受け取れずガス代が払えずロックされる問題を解決するサービス。JPYC社からの振込履歴があるKYC済みアドレスにガス代を送ってロックを解消します。",
  keywords: ["JPYC", "ガス代", "Polygon", "MATIC", "POL", "DeFi", "ウォレット"],
  authors: [{ name: "JPYC Gas Fee Support" }],
  openGraph: {
    title: "JPYCユーザーのガス代支援",
    description:
      "JPYCしか受け取れずガス代が払えずロックされる問題を解決するサービス。JPYC社からの振込履歴があるKYC済みアドレスにガス代を送ってロックを解消します。",
    type: "website",
    locale: "ja_JP",
    siteName: "JPYCユーザーのガス代支援",
    images: [
      {
        url: "/ScreenRecording 2025-11-02 4.04.35.png",
        width: 1200,
        height: 630,
        alt: "JPYCユーザーのガス代支援",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "JPYCユーザーのガス代支援",
    description:
      "JPYCしか受け取れずガス代が払えずロックされる問題を解決するサービス。JPYC社からの振込履歴があるKYC済みアドレスにガス代を送ってロックを解消します。",
    images: ["/ScreenRecording 2025-11-02 4.04.35.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
