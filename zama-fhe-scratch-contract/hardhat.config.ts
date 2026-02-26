import "dotenv/config";
import "@fhevm/hardhat-plugin";
import "@nomicfoundation/hardhat-ethers";
import "@nomicfoundation/hardhat-verify";
import "@typechain/hardhat";
import "hardhat-deploy";
import "hardhat-gas-reporter";
import type { HardhatUserConfig } from "hardhat/config";
import "./scratch-card.task.js";

const privateKey = process.env.PRIVATE_KEY?.trim();
const normalizedPrivateKey = privateKey
  ? privateKey.startsWith("0x")
    ? privateKey
    : `0x${privateKey}`
  : undefined;

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.30",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      viaIR: true,
      metadata: {
        bytecodeHash: "none",
        useLiteralContent: true,
      },
    },
  },
  networks: {
    localhost: {
      chainId: 31337,
    },
    sepolia: {
      url: process.env.SEPOLIA_RPC_URL || "https://ethereum-sepolia-rpc.publicnode.com",
      chainId: 11155111,
      accounts: normalizedPrivateKey ? [normalizedPrivateKey] : [],
      timeout: 120000,
      gasPrice: "auto",
    },
  },
  sourcify: {
    enabled: true
  }
};

export default config;
