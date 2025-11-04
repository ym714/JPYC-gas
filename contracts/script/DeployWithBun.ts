import { spawn } from "bun";
import { config } from "dotenv";

// 環境変数を読み込む
config();

interface DeployConfig {
  network?: string;
  rpcUrl?: string;
  privateKey?: string;
  chainId?: string;
  verify?: boolean;
  etherscanApiKey?: string;
}

async function deploy(config: DeployConfig = {}) {
  const {
    network = process.env.NETWORK || "sepolia",
    rpcUrl = process.env.RPC_URL,
    privateKey = process.env.PRIVATE_KEY,
    chainId = process.env.CHAIN_ID || "11155111",
    verify = false,
    etherscanApiKey = process.env.ETHERSCAN_API_KEY,
  } = config;

  if (!rpcUrl) {
    throw new Error("RPC_URL is required. Set it in .env or pass as argument.");
  }

  if (!privateKey) {
    throw new Error("PRIVATE_KEY is required. Set it in .env or pass as argument.");
  }

  // Foundryのスクリプトを実行
  const scriptPath = "script/Deploy.s.sol:DeployScript";
  const args = [
    scriptPath,
    "--rpc-url",
    rpcUrl,
    "--broadcast",
  ];

  if (verify && etherscanApiKey) {
    args.push("--verify", "--etherscan-api-key", etherscanApiKey);
  }

  console.log("🚀 Deploying contract...");
  console.log(`Network: ${network}`);
  console.log(`RPC URL: ${rpcUrl}`);
  console.log(`Chain ID: ${chainId}`);

  const forgeProcess = spawn({
    cmd: ["forge", "script", ...args],
    env: {
      ...process.env,
      PRIVATE_KEY: privateKey,
      RPC_URL: rpcUrl,
      CHAIN_ID: chainId,
    },
    stdout: "inherit",
    stderr: "inherit",
  });

  const exitCode = await forgeProcess.exited;

  if (exitCode !== 0) {
    throw new Error(`Deployment failed with exit code ${exitCode}`);
  }

  console.log("✅ Deployment completed successfully!");
}

// コマンドライン引数から設定を取得
const args = process.argv.slice(2);
const config: DeployConfig = {};

for (let i = 0; i < args.length; i += 2) {
  const key = args[i]?.replace("--", "");
  const value = args[i + 1];
  if (key && value) {
    config[key as keyof DeployConfig] = value as any;
  }
}

// メイン実行
deploy(config).catch((error) => {
  console.error("❌ Deployment error:", error);
  process.exit(1);
});

