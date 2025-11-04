// 広告データの型定義
export interface Commercial {
  "alt-text": string;
  "image-url": string;
  "href-url": string;
  bidder?: string;
  bidAmount?: string;
  timestamp?: number;
}

// デフォルトの広告データ（初期値）
export const defaultCommercial: Commercial = {
  "alt-text": "konaito-copilot",
  "image-url":
    "https://jpyc-volunteer.vercel.app/ScreenRecording%202025-11-04%2010.29.44.png",
  "href-url": "https://x.com/konaito_copilot",
};

// 後方互換性のため
export const commercial = defaultCommercial;
