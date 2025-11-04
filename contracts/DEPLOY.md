# デプロイガイド

## 環境変数の設定

`contracts/`ディレクトリに`.env`ファイルを作成してください：

```bash
# 必須
PRIVATE_KEY=your_private_key_without_0x_prefix
RPC_URL=https://polygon-amoy.g.alchemy.com/v2/YOUR_API_KEY

# オプション
# Etherscan API Key（コントラクト検証用、オプション）
# ソースコードをEtherscanで公開したい場合のみ設定
# ETHERSCAN_API_KEY=your_etherscan_api_key

# JPYDの初期供給量（デフォルト: 1,000,000）
INITIAL_SUPPLY=1000000

# AdAuctionの初期広告データ（default.tsの値がデフォルト）
# INITIAL_IMAGE_URL=https://jpyc-volunteer.vercel.app/ScreenRecording%202025-11-04%2010.29.44.png
# INITIAL_ALT_TEXT=konaito-copilot
# INITIAL_HREF_URL=https://x.com/konaito_copilot
```

## JPYDトークンのデプロイ

### 1. 環境変数を設定

```bash
cd contracts
```

`.env`ファイルを作成（テンプレートからコピー）：
```bash
# テンプレートからコピー
cp env.template .env

# エディタで .env を開いて値を設定
# PRIVATE_KEY=your_private_key_here
# RPC_URL=https://polygon-amoy.g.alchemy.com/v2/YOUR_ALCHEMY_API_KEY
```

### 2. デプロイ実行

```bash
# 基本的なデプロイ（検証なし）
forge script script/DeployJPYD.s.sol:DeployJPYDScript \
  --rpc-url $RPC_URL \
  --broadcast \
  -vvv

# または、直接RPC URLを指定
forge script script/DeployJPYD.s.sol:DeployJPYDScript \
  --rpc-url https://polygon-amoy.g.alchemy.com/v2/YOUR_API_KEY \
  --broadcast \
  -vvv

# Etherscan検証付きでデプロイ（オプション）
# ソースコードをEtherscanで公開したい場合のみ使用
forge script script/DeployJPYD.s.sol:DeployJPYDScript \
  --rpc-url $RPC_URL \
  --broadcast \
  --verify \
  --etherscan-api-key $ETHERSCAN_API_KEY \
  -vvv
```

**注意**: `--verify`オプションは必須ではありません。コントラクトのソースコードをEtherscanで公開したい場合のみ使用してください。

### 3. デプロイ後の確認

デプロイが成功すると、以下の情報が表示されます：
- コントラクトアドレス
- トークン名とシンボル
- 総供給量
- オーナーアドレス

## AdAuctionコントラクトのデプロイ

### 1. 環境変数を設定（JPYDと同じ）

### 2. デプロイ実行

```bash
# 基本的なデプロイ（検証なし）
forge script script/DeployAdAuction.s.sol:DeployAdAuctionScript \
  --rpc-url $RPC_URL \
  --broadcast \
  -vvv

# Etherscan検証付きでデプロイ（オプション）
forge script script/DeployAdAuction.s.sol:DeployAdAuctionScript \
  --rpc-url $RPC_URL \
  --broadcast \
  --verify \
  --etherscan-api-key $ETHERSCAN_API_KEY \
  -vvv
```

### 3. デプロイ後の設定

1. デプロイされたAdAuctionコントラクトのアドレスをコピー
2. フロントエンドの`.env.local`に設定：
   ```bash
   NEXT_PUBLIC_COMMERCIAL_CONTRACT_ADDRESS=0x...
   ```

3. オーナーとしてERC20トークンアドレスを設定（JPYDを設定する場合）：
   - `/owner`ページにアクセス
   - ERC20トークンアドレスにJPYDのアドレスを設定

## トラブルシューティング

### 秘密鍵の形式エラー

秘密鍵は`0x`プレフィックスなしで、数値として解釈できる形式で設定してください：
```bash
# 正しい形式
PRIVATE_KEY=1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef

# または、数値として
PRIVATE_KEY=8732847923847923847923847923847923847923847923847923847923847923
```

### RPC URLが見つからない

`.env`ファイルが`contracts/`ディレクトリに存在することを確認してください。また、環境変数が正しく読み込まれているか確認：

```bash
# 環境変数を確認
echo $PRIVATE_KEY
echo $RPC_URL
```

### デプロイが失敗する

- ネットワークが正しいか確認（テストネット用のRPC URLを使用）
- 秘密鍵に対応するウォレットに十分なガス代があるか確認
- Foundryが正しくインストールされているか確認：`forge --version`

