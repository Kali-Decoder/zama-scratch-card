import { ethers } from "ethers";
import { upsertTransactionLog } from "@/app/services/transaction-log.service";

const SCRATCH_CARD_ABI = [
  {
    inputs: [{ internalType: "uint256", name: "_price", type: "uint256" }],
    stateMutability: "nonpayable",
    type: "constructor",
  },
  {
    inputs: [],
    name: "ZamaProtocolUnsupported",
    type: "error",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "address", name: "owner", type: "address" },
      { indexed: false, internalType: "uint256", name: "amount", type: "uint256" },
    ],
    name: "OwnerWithdraw",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "address", name: "player", type: "address" },
      { indexed: false, internalType: "uint256", name: "amount", type: "uint256" },
    ],
    name: "RewardsClaimed",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "address", name: "player", type: "address" },
      { indexed: false, internalType: "uint128", name: "reward", type: "uint128" },
      { indexed: false, internalType: "uint128", name: "claimableAfter", type: "uint128" },
    ],
    name: "ScratchPlayed",
    type: "event",
  },
  {
    inputs: [{ internalType: "address", name: "", type: "address" }],
    name: "claimableRewards",
    outputs: [{ internalType: "uint128", name: "", type: "uint128" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "address", name: "", type: "address" }],
    name: "claimedRewards",
    outputs: [{ internalType: "uint128", name: "", type: "uint128" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "confidentialProtocolId",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "owner",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "uint128", name: "amount", type: "uint128" }],
    name: "claimRewards",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ internalType: "address", name: "player", type: "address" }],
    name: "getClaimStatus",
    outputs: [
      { internalType: "uint128", name: "claimable", type: "uint128" },
      { internalType: "uint128", name: "claimed", type: "uint128" },
      { internalType: "uint128", name: "lastReward", type: "uint128" },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "scratchCard",
    outputs: [],
    stateMutability: "payable",
    type: "function",
  },
  {
    inputs: [{ internalType: "address", name: "", type: "address" }],
    name: "lastScratchReward",
    outputs: [{ internalType: "uint128", name: "", type: "uint128" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "scratchPrice",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "uint256", name: "newPrice", type: "uint256" }],
    name: "setScratchPrice",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "totalPendingPlain",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "uint256", name: "amount", type: "uint256" }],
    name: "withdrawProfit",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    stateMutability: "payable",
    type: "receive",
  },
] as const;

const DEFAULT_CONTRACT =
  process.env.SCRATCH_CARD_CONTRACT ??
  process.env.NEXT_PUBLIC_SCRATCH_CARD_CONTRACT ??
  "0x91d1c6Aba776e827C0cA34627AE5cA1931855717";

const DEFAULT_RPC_URL = process.env.BATCH_RPC_URL ?? "https://rpc.sepolia.org";
const MAX_REQUEST_AGE_MS = 5 * 60 * 1000;

type BatchOptions = {
  walletCount?: number;
  maxRoundsPerWallet?: number;
  reactivityPolls?: number;
  reactivityPollMs?: number;
  saveWallets?: boolean;
};

export type BatchBody = {
  requester?: string;
  requestedAt?: number;
  signature?: string;
  options?: BatchOptions;
};

type SafeOptions = {
  walletCount: number;
  maxRoundsPerWallet: number;
  reactivityPolls: number;
  reactivityPollMs: number;
  saveWallets: boolean;
};

function toPositiveInt(value: unknown, fallback: number) {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) return fallback;
  return n;
}

function normalizeOptions(options?: BatchOptions): SafeOptions {
  return {
    walletCount: toPositiveInt(options?.walletCount, toPositiveInt(process.env.BATCH_WALLET_COUNT, 5)),
    maxRoundsPerWallet: toPositiveInt(
      options?.maxRoundsPerWallet,
      toPositiveInt(process.env.BATCH_MAX_ROUNDS_PER_WALLET, 10)
    ),
    reactivityPolls: toPositiveInt(
      options?.reactivityPolls,
      toPositiveInt(process.env.BATCH_REACTIVITY_POLLS, 20)
    ),
    reactivityPollMs: toPositiveInt(
      options?.reactivityPollMs,
      toPositiveInt(process.env.BATCH_REACTIVITY_POLL_MS, 2000)
    ),
    saveWallets: options?.saveWallets ?? process.env.BATCH_SAVE_WALLETS === "true",
  };
}

export function buildBatchSignatureMessage(params: {
  requester: string;
  requestedAt: number;
  options: SafeOptions;
  contractAddress?: string;
}) {
  const { requester, requestedAt, options, contractAddress = DEFAULT_CONTRACT } = params;
  return [
    "scratch-your-card admin batch run",
    `requester:${requester.toLowerCase()}`,
    `requestedAt:${requestedAt}`,
    `walletCount:${options.walletCount}`,
    `maxRoundsPerWallet:${options.maxRoundsPerWallet}`,
    `reactivityPolls:${options.reactivityPolls}`,
    `reactivityPollMs:${options.reactivityPollMs}`,
    `saveWallets:${options.saveWallets}`,
    `contract:${contractAddress.toLowerCase()}`,
  ].join("\n");
}

function extractScratchReward(receipt: ethers.TransactionReceipt, gameInterface: ethers.Interface): bigint {
  for (const log of receipt.logs) {
    try {
      const parsed = gameInterface.parseLog(log);
      if (parsed?.name === "ScratchPlayed" && parsed.args?.reward !== undefined) {
        return BigInt(parsed.args.reward);
      }
    } catch {
      continue;
    }
  }
  return BigInt(0);
}

export async function executeAdminBatchScratch(body: BatchBody) {
  console.log("[batch] Starting admin batch scratch run");
  const adminPrivateKey = process.env.BATCH_ADMIN_PRIVATE_KEY || process.env.ADMIN_PRIVATE_KEY;
  if (!adminPrivateKey) {
    console.error("[batch] Missing admin private key env");
    throw new Error("Server missing BATCH_ADMIN_PRIVATE_KEY or ADMIN_PRIVATE_KEY");
  }

  const requester = String(body?.requester || "").trim().toLowerCase();
  const requestedAt = Number(body?.requestedAt);
  const signature = String(body?.signature || "").trim();
  const options = normalizeOptions(body?.options);

  if (!requester || !Number.isFinite(requestedAt) || !signature) {
    console.error("[batch] Invalid request payload", {
      hasRequester: Boolean(requester),
      requestedAt,
      hasSignature: Boolean(signature),
    });
    throw new Error("Missing requester, requestedAt, or signature");
  }

  if (Math.abs(Date.now() - requestedAt) > MAX_REQUEST_AGE_MS) {
    console.error("[batch] Request expired", { requestedAt, now: Date.now() });
    throw new Error("Request expired. Please retry from admin panel.");
  }
  console.log("[batch] Request validated", {
    requester,
    walletCount: options.walletCount,
    maxRoundsPerWallet: options.maxRoundsPerWallet,
  });

  const contractAddress = DEFAULT_CONTRACT;
  const message = buildBatchSignatureMessage({
    requester,
    requestedAt,
    options,
    contractAddress,
  });
  const recovered = ethers.verifyMessage(message, signature).toLowerCase();

  if (recovered !== requester) {
    console.error("[batch] Signature verification failed", { requester, recovered });
    throw new Error("Signature verification failed");
  }
  console.log("[batch] Signature verified");

  const provider = new ethers.JsonRpcProvider(DEFAULT_RPC_URL);
  const code = await provider.getCode(contractAddress);
  if (code === "0x") {
    console.error("[batch] No contract code", { contractAddress });
    throw new Error(
      `No contract found at ${contractAddress}. Set SCRATCH_CARD_CONTRACT or NEXT_PUBLIC_SCRATCH_CARD_CONTRACT.`
    );
  }

  const readonlyGame = new ethers.Contract(contractAddress, SCRATCH_CARD_ABI, provider);
  const ownerAddress = String(await readonlyGame.owner()).toLowerCase();
  if (ownerAddress !== requester) {
    console.error("[batch] Requester is not owner", { ownerAddress, requester });
    const err = new Error("Admin action blocked: requester is not contract owner");
    (err as Error & { status?: number }).status = 403;
    throw err;
  }
  console.log("[batch] Owner check passed", { ownerAddress });

  const signer = new ethers.Wallet(adminPrivateKey, provider);
  const gameFromAdmin = new ethers.Contract(contractAddress, SCRATCH_CARD_ABI, signer);

  const fundPerWallet = ethers.parseEther(
    process.env.BATCH_FUND_PER_WALLET_ETH ?? process.env.BATCH_FUND_PER_WALLET_STT ?? "0.5"
  );
  const gasReserve = ethers.parseEther(
    process.env.BATCH_GAS_RESERVE_ETH ?? process.env.BATCH_GAS_RESERVE_STT ?? "0.01"
  );
  const scratchPrice = (await gameFromAdmin.scratchPrice()) as bigint;
  console.log("[batch] Config loaded", {
    contractAddress,
    rpc: DEFAULT_RPC_URL,
    fundPerWallet: ethers.formatEther(fundPerWallet),
    gasReserve: ethers.formatEther(gasReserve),
    scratchPrice: ethers.formatEther(scratchPrice),
  });

  const wallets = Array.from({ length: options.walletCount }, () =>
    ethers.Wallet.createRandom().connect(provider)
  );

  const generatedWallets = options.saveWallets
    ? wallets.map((w, i) => ({ index: i + 1, address: w.address, privateKey: w.privateKey }))
    : undefined;

  const requiredAdminBalance = fundPerWallet * BigInt(options.walletCount);
  const adminBalance = await provider.getBalance(signer.address);
  if (adminBalance < requiredAdminBalance) {
    console.error("[batch] Insufficient admin balance", {
      adminWallet: signer.address,
      adminBalance: ethers.formatEther(adminBalance),
      requiredAdminBalance: ethers.formatEther(requiredAdminBalance),
    });
    throw new Error(
      `Insufficient admin wallet balance. Need at least ${ethers.formatEther(
        requiredAdminBalance
      )} ETH for funding (gas not included).`
    );
  }

  const network = await provider.getNetwork();
  const chainId = Number(network.chainId);
  console.log("[batch] Network ready", {
    network: network.name,
    chainId,
    adminWallet: signer.address,
  });

  const fundedWallets: Array<{ address: string; txHash: string }> = [];

  console.log("[batch] Funding generated wallets", { walletCount: wallets.length });
  for (let i = 0; i < wallets.length; i++) {
    const wallet = wallets[i];
    const tx = await signer.sendTransaction({ to: wallet.address, value: fundPerWallet });
    await tx.wait();
    fundedWallets.push({ address: wallet.address, txHash: tx.hash });
    console.log(`[batch] Funded ${i + 1}/${wallets.length}`, {
      wallet: wallet.address,
      txHash: tx.hash,
      amount: ethers.formatEther(fundPerWallet),
    });
  }

  let totalScratches = 0;
  let totalClaims = BigInt(0);
  let totalSpent = BigInt(0);

  const walletSummaries: Array<{
    walletAddress: string;
    rounds: number;
    spentWei: string;
    claimedWei: string;
  }> = [];

  console.log("[batch] Starting scratch/claim loop");
  for (let i = 0; i < wallets.length; i++) {
    const wallet = wallets[i];
    const game = new ethers.Contract(contractAddress, SCRATCH_CARD_ABI, wallet);
    let rounds = 0;
    let walletClaimed = BigInt(0);
    let walletSpent = BigInt(0);
    console.log(`[batch] Wallet ${i + 1}/${wallets.length} started`, { wallet: wallet.address });

    while (rounds < options.maxRoundsPerWallet) {
      const balance = await provider.getBalance(wallet.address);
      if (balance < scratchPrice + gasReserve) {
        console.log("[batch] Wallet stopped (low balance)", {
          wallet: wallet.address,
          balance: ethers.formatEther(balance),
          minRequired: ethers.formatEther(scratchPrice + gasReserve),
        });
        break;
      }

      const scratchTx = await game.scratchCard({ value: scratchPrice });
      const scratchReceipt = await scratchTx.wait();
      console.log("[batch] Scratch tx confirmed", {
        wallet: wallet.address,
        round: rounds + 1,
        txHash: scratchTx.hash,
      });

      rounds += 1;
      totalScratches += 1;
      walletSpent += scratchPrice;
      totalSpent += scratchPrice;

      const rewardDelta = extractScratchReward(scratchReceipt, game.interface);

      await upsertTransactionLog({
        walletAddress: wallet.address,
        txHash: scratchTx.hash,
        action: "scratch_reward",
        amountWei: rewardDelta.toString(),
        contractAddress,
        chainId,
      });
      console.log("[batch] Scratch logged to MongoDB", {
        wallet: wallet.address,
        txHash: scratchTx.hash,
        rewardWei: rewardDelta.toString(),
      });

      const [claimableNow] = (await game.getClaimStatus(wallet.address)) as [bigint, bigint, bigint];
      if (claimableNow > BigInt(0)) {
        const claimTx = await game.claimRewards(claimableNow);
        await claimTx.wait();
        walletClaimed += claimableNow;
        totalClaims += claimableNow;
        await upsertTransactionLog({
          walletAddress: wallet.address,
          txHash: claimTx.hash,
          action: "claim",
          amountWei: claimableNow.toString(),
          contractAddress,
          chainId,
        });
        console.log("[batch] Claim logged to MongoDB", {
          wallet: wallet.address,
          txHash: claimTx.hash,
          amountWei: claimableNow.toString(),
        });
      }

      console.log("[batch] Round completed", {
        wallet: wallet.address,
        round: rounds,
        rewardWei: rewardDelta.toString(),
      });
    }

    walletSummaries.push({
      walletAddress: wallet.address,
      rounds,
      spentWei: walletSpent.toString(),
      claimedWei: walletClaimed.toString(),
    });
    console.log(`[batch] Wallet ${i + 1} summary`, {
      wallet: wallet.address,
      rounds,
      spentWei: walletSpent.toString(),
      claimedWei: walletClaimed.toString(),
    });
  }

  console.log("[batch] Batch run complete", {
    wallets: options.walletCount,
    scratches: totalScratches,
    spentWei: totalSpent.toString(),
    claimsWei: totalClaims.toString(),
    netWei: (totalClaims - totalSpent).toString(),
  });

  return {
    network: network.name,
    chainId,
    adminWallet: signer.address,
    contractAddress,
    walletCount: options.walletCount,
    maxRoundsPerWallet: options.maxRoundsPerWallet,
    fundPerWalletWei: fundPerWallet.toString(),
    gasReserveWei: gasReserve.toString(),
    scratchPriceWei: scratchPrice.toString(),
    totalScratches,
    totalSpentWei: totalSpent.toString(),
    totalClaimsWei: totalClaims.toString(),
    netWei: (totalClaims - totalSpent).toString(),
    fundedWallets,
    generatedWallets,
    walletSummaries,
  };
}
