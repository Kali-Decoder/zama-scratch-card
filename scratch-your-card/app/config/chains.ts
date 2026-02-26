import { Chain } from "viem";

export const sepolia: Chain = {
  id: 11155111,
  name: "Sepolia",
  nativeCurrency: {
    decimals: 18,
    name: "Ether",
    symbol: "ETH",
  },
  rpcUrls: {
    default: {
      http: ["https://rpc.sepolia.org"],
    },
    public: {
      http: ["https://rpc.sepolia.org"],
    },
  },
  blockExplorers: {
    default: {
      name: "Etherscan",
      url: "https://sepolia.etherscan.io",
    },
  },
  testnet: true,
};

export const allChains: Chain[] = [sepolia];
export const mainnetChains: Chain[] = [];
export const testnetChains: Chain[] = [sepolia];
export const popularChains: Chain[] = [sepolia];

export const getChainById = (chainId: number): Chain | undefined => {
  return chainId === sepolia.id ? sepolia : undefined;
};

export const getChainDisplayName = (chain: Chain): string => {
  return chain.name;
};
