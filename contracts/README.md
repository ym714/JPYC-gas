# Contracts

Foundryベースのスマートコントラクト開発環境です。bunを使用してデプロイスクリプトを管理します。

## セットアップ

### 1. Foundryのインストール

```bash
# Foundryをインストール（初回のみ）
bun run install:foundry

# または手動でインストール
curl -L https://foundry.paradigm.xyz | bash
foundryup
```

### 2. 依存関係のインストール

```bash
bun install
```

### 3. 環境変数の設定

`contracts/`ディレクトリに`.env`ファイルを作成してください：

```bash
# テンプレートからコピー
cp env.template .env
```

その後、`.env`ファイルを編集して以下の変数を設定してください：

```bash
# 秘密鍵（0xプレフィックスなしのhex文字列、または数値）
PRIVATE_KEY=your_private_key_here

# RPC URL（テストネット用）
RPC_URL=https://polygon-amoy.g.alchemy.com/v2/YOUR_API_KEY
# または
# RPC_URL=https://rpc.ankr.com/polygon_amoy

# Network Configuration（オプション）
NETWORK=amoy
CHAIN_ID=80002

# Etherscan API Key (オプション、コントラクト検証用)
# ソースコードをEtherscanで公開したい場合のみ設定
# ETHERSCAN_API_KEY=your_etherscan_api_key_here

# JPYDデプロイ時の初期供給量（オプション、デフォルト: 1000000）
INITIAL_SUPPLY=1000000
```

**注意**: `.env`ファイルは`.gitignore`に含まれているため、Gitにコミットされません。

## 使用方法

### コントラクトのビルド

```bash
bun run build
```

### テストの実行

```bash
# 通常のテスト
bun run test

# 詳細な出力でテスト
bun run test:verbose

# カバレッジレポート
bun run test:coverage
```

### コントラクトのデプロイ

#### JPYDトークンのデプロイ

```bash
# 基本的なデプロイ（検証なし）
forge script script/DeployJPYD.s.sol:DeployJPYDScript \
  --rpc-url $RPC_URL \
  --broadcast

# Etherscan検証付きでデプロイ（オプション）
forge script script/DeployJPYD.s.sol:DeployJPYDScript \
  --rpc-url $RPC_URL \
  --broadcast \
  --verify \
  --etherscan-api-key $ETHERSCAN_API_KEY
```

#### AdAuctionコントラクトのデプロイ

```bash
# 基本的なデプロイ（検証なし）
forge script script/DeployAdAuction.s.sol:DeployAdAuctionScript \
  --rpc-url $RPC_URL \
  --broadcast

# Etherscan検証付きでデプロイ（オプション）
forge script script/DeployAdAuction.s.sol:DeployAdAuctionScript \
  --rpc-url $RPC_URL \
  --broadcast \
  --verify \
  --etherscan-api-key $ETHERSCAN_API_KEY
```

#### bunスクリプトを使用したデプロイ（AdAuction用）

```bash
# bunスクリプトを使用してデプロイ
bun run deploy

# 環境変数で設定をオーバーライド
bun run deploy -- --rpcUrl https://polygon-amoy.g.alchemy.com/v2/YOUR_KEY --privateKey YOUR_PRIVATE_KEY

# Etherscan検証付きでデプロイ
bun run deploy -- --verify true --etherscanApiKey YOUR_API_KEY
```

### コードフォーマット

```bash
bun run format
```

### スナップショットの作成

```bash
bun run snapshot
```

## ディレクトリ構造

```
contracts/
├── src/           # コントラクトソースコード
├── script/        # デプロイスクリプト（Solidity + TypeScript）
├── test/          # テストコード
├── foundry.toml   # Foundry設定ファイル
└── package.json   # bun依存関係とスクリプト
```

## コントラクトの追加方法

1. `src/`ディレクトリに新しいコントラクトファイル（`.sol`）を作成
2. 必要に応じて`script/`ディレクトリにデプロイスクリプトを追加
3. `test/`ディレクトリにテストコードを追加

## トラブルシューティング

### Foundryが見つからないエラー

Foundryがインストールされているか確認してください：

```bash
forge --version
```

インストールされていない場合は、`bun run install:foundry`を実行してください。

### 環境変数が読み込まれない

`.env`ファイルが`contracts/`ディレクトリに存在することを確認してください。また、`.gitignore`に`.env`が含まれていることを確認してください。

