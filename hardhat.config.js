require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

// Add your private key and API keys in .env file
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY;

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.28",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    hardhat: {},
    // Base Mainnet
    base: {
      url: "https://mainnet.base.org",
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
      verify: {
        etherscan: {
          apiUrl: "https://base.blockscout.com",
        },
      },
    },
    // Base Sepolia (testnet)
    "base-sepolia": {
      url: "https://sepolia.base.org",
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
      verify: {
        etherscan: {
          apiUrl: "https://sepolia-explorer.base.org",
        },
      },
    },
  },
  etherscan: {
    apiKey: {
      base: ETHERSCAN_API_KEY,
      baseSepolia: ETHERSCAN_API_KEY
    },
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS !== undefined,
    currency: "USD",
  },
};
