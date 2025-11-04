# 環境変数の設定

フロントエンドアプリケーションを実行するために、以下の環境変数を設定してください。

## 必要な環境変数

`.env.local`ファイルをプロジェクトルート（`frontend/`ディレクトリ）に作成し、以下の環境変数を設定してください：

```bash
# WalletConnect Project ID
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your-project-id

# コマーシャル（広告オークション）コントラクトアドレス
NEXT_PUBLIC_COMMERCIAL_CONTRACT_ADDRESS=0x...
```

## 環境変数の説明

### NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID
WalletConnectのプロジェクトIDです。MetaMaskなどのウォレット接続に使用されます。

### NEXT_PUBLIC_COMMERCIAL_CONTRACT_ADDRESS
広告オークションコントラクト（AdAuction）のデプロイ済みアドレスです。
コントラクトをデプロイした後、このアドレスを設定してください。

## 設定方法

1. `frontend/`ディレクトリに`.env.local`ファイルを作成
2. 上記の環境変数を設定
3. アプリケーションを再起動

注意: `.env.local`ファイルは`.gitignore`に含まれているため、Gitにコミットされません。

