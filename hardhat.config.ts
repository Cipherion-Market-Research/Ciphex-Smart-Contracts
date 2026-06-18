import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@openzeppelin/hardhat-upgrades";
import "hardhat-deploy";
import "hardhat-gas-reporter";
import "solidity-coverage";
import "solidity-docgen";
import "@nomiclabs/hardhat-solhint";
import "@nomicfoundation/hardhat-ignition-ethers";

// To run tests or deploy, create secrets.json and rpcs.json from the templates:
//   cp secrets.template.json secrets.json
//   cp rpcs.template.json rpcs.json
// Then populate with your own keys and RPC URLs.

let prodPrivateKey = "";
let devPrivateKey = "";
let etherscanApiKey = "";
let basescanApiKey = "";
let coinmarketcapApiKey = "";
let rpcs: Record<string, string> = { mainnet: "", sepolia: "", baseSepolia: "", base: "" };

try {
  const secrets = require("./secrets.json");
  prodPrivateKey = secrets.prodPrivateKey;
  devPrivateKey = secrets.devPrivateKey;
  etherscanApiKey = secrets.etherscanApiKey;
  basescanApiKey = secrets.basescanApiKey;
  coinmarketcapApiKey = secrets.coinmarketcapApiKey;
  rpcs = require("./rpcs.json");
} catch {
  // Running without secrets -- compilation and local tests still work
}

const config: HardhatUserConfig = {
  solidity: {
    compilers: [
      {
        version: "0.8.27",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
    ],
  },
  networks: {
    hardhat: {
      forking: {
        enabled: !!rpcs.mainnet,
        url: rpcs.mainnet || "https://eth.llamarpc.com",
        blockNumber: 20984600,
      },
    },
    localhost: {
      url: "http://127.0.0.1:8545/",
    },
    mainnet: {
      url: rpcs.mainnet || "",
      chainId: 1,
      accounts: prodPrivateKey ? [prodPrivateKey] : [],
    },
  },
  gasReporter: {
    enabled: true,
    excludeContracts: ["mocks/"],
    currency: "USD",
    coinmarketcap: coinmarketcapApiKey || undefined,
  },
  etherscan: {
    apiKey: {
      mainnet: etherscanApiKey,
    },
    customChains: [
      {
        network: "mainnet",
        chainId: 1,
        urls: {
          apiURL: "https://api.etherscan.io/api",
          browserURL: "https://etherscan.io",
        },
      },
    ],
  },
  docgen: {
    pages: "files",
    exclude: ["interfaces", "mocks"],
  },
};

export default config;
