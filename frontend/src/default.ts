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
    "https://prcdn.freetls.fastly.net/release_image/46288/150/46288-150-4068449046755ead34a8b0c5252c2b82-1280x720.jpg?width=1950&height=1350&quality=85%2C75&format=jpeg&auto=webp&fit=bounds&bg-color=fff",
  "href-url": "https://x.com/konaito_copilot",
};

// 後方互換性のため
export const commercial = defaultCommercial;
