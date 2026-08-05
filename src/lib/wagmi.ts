import { createConfig, http } from "wagmi";
import { defineChain } from "viem";
import { injected, walletConnect } from "wagmi/connectors";

const projectId = import.meta.env["VITE_WALLETCONNECT_PROJECT_ID"] as string | undefined;

export const ritualChain = defineChain({
  id: 1979,
  name: "Ritual Chain",
  nativeCurrency: { name: "Ritual", symbol: "RITUAL", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://rpc.ritualfoundation.org"] },
  },
});

/** Wallet that receives the zero-value daily access confirmation transaction. */
export const OWNER_ADDRESS =
  "0x085Ef764668675899fAac88920071DB37103AF1e" as const;

export const ACCESS_CONTRACT_ADDRESS =
  "0x78E4f1cB2fDAb262980372f325984A8970fE3492" as const;

export const ACCESS_CONTRACT_ABI = [
  {
    inputs: [],
    name: "payForAccess",
    outputs: [],
    stateMutability: "payable",
    type: "function",
  },
  {
    inputs: [{ internalType: "address", name: "user", type: "address" }],
    name: "hasAccess",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "address", name: "user", type: "address" }],
    name: "lastAccessDay",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "getTimeUntilReset",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

/** Daily access price in RITUAL. */
export const ACCESS_PRICE = "0.001";

export const wagmiConfig = createConfig({
  chains: [ritualChain],
  ssr: true,
  connectors: [
    injected({ shimDisconnect: true }),
    ...(projectId
      ? [
          walletConnect({
            projectId,
            metadata: {
              name: "TradeLog Pro",
              description: "Digital trading journal",
              url: typeof window !== "undefined" ? window.location.origin : "https://tradinglog-pro.lovable.app",
              icons: [],
            },
          }),
        ]
      : []),
  ],
  transports: { [ritualChain.id]: http("https://rpc.ritualfoundation.org") },
});

export function shortAddress(address?: string | null) {
  if (!address) return "";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}
