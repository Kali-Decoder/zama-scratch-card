"use client";

import { ReactNode, useEffect, useMemo, useState } from "react";
import { ethers } from "ethers";
import AnimatedNumbers from "react-animated-numbers";
import Image from "next/image";
import {
  AlertTriangle,
  Coins,
  ExternalLink,
  Loader2,
  Network,
  RefreshCw,
  Ticket,
  X,
} from "lucide-react";
import { sepolia } from "./config/chains";
import { SCRATCH_CARD_ABI, SCRATCH_CARD_ADDRESS } from "./config/scratch_game_config";
import { ScratchSurface } from "./components/ScratchSurface";
import { useReactivityStatus } from "./contexts/ReactivityStatusContext";

type PlayerStats = {
  totalRewarded: bigint;
  scratches: bigint;
  totalClaimed: bigint;
};

type ScratchResult = {
  reward: bigint;
  settledAt: number;
  payoutTxHash?: string;
};

type ConfettiPiece = {
  id: string;
  left: number;
  size: number;
  delay: number;
  duration: number;
  color: string;
  drift: number;
  rotate: number;
};

type StickerPlacement = {
  id: string;
  src: string;
  top: string;
  left: string;
  rotateDeg: number;
  scale: number;
  width: number;
  height: number;
};

const ZERO_BI = BigInt(0);
const FIVE_BI = BigInt(5);
const MAX_UINT128 = (BigInt(1) << BigInt(128)) - BigInt(1);

const ZERO_STATS: PlayerStats = {
  totalRewarded: ZERO_BI,
  scratches: ZERO_BI,
  totalClaimed: ZERO_BI,
};

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const formatEth = (value: bigint, digits = 4) => {
  const eth = Number(ethers.formatEther(value));
  if (!Number.isFinite(eth)) return "0";
  return eth.toFixed(digits);
};

const getErrorData = (error: any): string | undefined => {
  const direct = typeof error?.data === "string" ? error.data : undefined;
  const info = typeof error?.info?.error?.data === "string" ? error.info.error.data : undefined;
  const revert = typeof error?.revert?.data === "string" ? error.revert.data : undefined;
  return direct || info || revert;
};

const getCustomErrorSelector = (error: any): string | null => {
  const data = getErrorData(error);
  if (!data || !data.startsWith("0x") || data.length < 10) return null;
  return data.slice(0, 10).toLowerCase();
};

const getScratchFailureMessage = (error: any) => {
  const selector = getCustomErrorSelector(error);

  if (selector === "0x9de3392c") {
    return `FHE guard: this contract rejected scratch for this protocol/network setup. Verify NEXT_PUBLIC_SCRATCH_CARD_CONTRACT points to the latest deployed game contract.`;
  }

  if (selector === "0x73cac13b") {
    return "FHE guard: Zama protocol is unsupported on this contract deployment.";
  }

  return error?.shortMessage || error?.message || "FHE scratch transaction failed";
};

export default function Home() {
  const [account, setAccount] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const [currentChainId, setCurrentChainId] = useState<number | null>(null);
  const [isSwitchingNetwork, setIsSwitchingNetwork] = useState(false);

  const [scratchPrice, setScratchPrice] = useState<bigint>(ZERO_BI);
  const [contractBalance, setContractBalance] = useState<bigint>(ZERO_BI);
  const [totalPendingPlain, setTotalPendingPlain] = useState<bigint>(ZERO_BI);
  const [claimableWei, setClaimableWei] = useState<bigint>(ZERO_BI);

  const [stats, setStats] = useState<PlayerStats>(ZERO_STATS);
  const [isLoading, setIsLoading] = useState(false);
  const [isScratching, setIsScratching] = useState(false);
  const [isClaimingRewards, setIsClaimingRewards] = useState(false);
  const [isProcessingReactivity, setIsProcessingReactivity] = useState(false);

  const [lastTxHash, setLastTxHash] = useState("");
  const [lastScratchTxHash, setLastScratchTxHash] = useState("");
  const [lastScratchResult, setLastScratchResult] = useState<ScratchResult | null>(null);
  const [scratchSurfaceKey, setScratchSurfaceKey] = useState(0);
  const [showScratchCard, setShowScratchCard] = useState(false);
  const [isScratchRevealed, setIsScratchRevealed] = useState(false);
  const [isScratchModalOpen, setIsScratchModalOpen] = useState(false);
  const [confettiPieces, setConfettiPieces] = useState<ConfettiPiece[]>([]);
  const [stickerPlacements, setStickerPlacements] = useState<StickerPlacement[]>([]);
  const { setStatus: setReactivityStatus } = useReactivityStatus();

  const isCorrectNetwork = currentChainId === sepolia.id;
  const canPlay = isConnected && isCorrectNetwork && !isScratching && !isClaimingRewards;
  const canClaim = canPlay && claimableWei > ZERO_BI;

  const availableLiquidity = useMemo(() => {
    if (contractBalance <= totalPendingPlain) return ZERO_BI;
    return contractBalance - totalPendingPlain;
  }, [contractBalance, totalPendingPlain]);

  const maxReward = useMemo(() => {
    return scratchPrice * FIVE_BI;
  }, [scratchPrice]);

  useEffect(() => {
    checkConnection();
    checkNetwork();

    if (typeof window === "undefined" || !(window as any).ethereum) return;

    const ethereum = (window as any).ethereum;
    ethereum.on("accountsChanged", handleAccountsChanged);
    ethereum.on("chainChanged", handleChainChanged);

    return () => {
      ethereum.removeListener("accountsChanged", handleAccountsChanged);
      ethereum.removeListener("chainChanged", handleChainChanged);
    };
  }, []);

  useEffect(() => {
    if (!isConnected || !account) return;
    refreshAll();

    const interval = setInterval(() => {
      refreshAll();
    }, 6000);

    return () => clearInterval(interval);
  }, [isConnected, account]);

  useEffect(() => {
    setReactivityStatus(isProcessingReactivity ? "processing" : "idle");
    return () => setReactivityStatus("idle");
  }, [isProcessingReactivity, setReactivityStatus]);

  useEffect(() => {
    const slotPool = [
      { top: "6%", left: "70%" },
      { top: "24%", left: "4%" },
      { top: "46%", left: "74%" },
      { top: "68%", left: "8%" },
      { top: "74%", left: "66%" },
    ];

    const shuffledSlots = [...slotPool].sort(() => Math.random() - 0.5);
    const placements: StickerPlacement[] = shuffledSlots.slice(0, 4).map((slot, index) => ({
        id: `floating-sticker-${index}`,
        src: "/scratch-win-sticker.svg",
        width: 220,
        height: 100,
        top: slot.top,
        left: slot.left,
        rotateDeg: -14 + Math.random() * 28,
        scale: 0.68 + Math.random() * 0.36,
      }));

    setStickerPlacements(placements);
  }, []);

  const checkConnection = async () => {
    if (typeof window === "undefined" || !(window as any).ethereum) return;

    try {
      const accounts = await (window as any).ethereum.request({ method: "eth_accounts" });
      if (accounts.length > 0) {
        setAccount(accounts[0]);
        setIsConnected(true);
      }
    } catch (error) {
      console.error("Failed to check wallet connection:", error);
    }
  };

  const checkNetwork = async () => {
    if (typeof window === "undefined" || !(window as any).ethereum) {
      setCurrentChainId(null);
      return;
    }

    try {
      const chainId = await (window as any).ethereum.request({ method: "eth_chainId" });
      setCurrentChainId(parseInt(chainId, 16));
    } catch (error) {
      console.error("Failed to check network:", error);
      setCurrentChainId(null);
    }
  };

  const handleAccountsChanged = (accounts: string[]) => {
    if (accounts.length > 0) {
      setAccount(accounts[0]);
      setIsConnected(true);
    } else {
      setAccount("");
      setIsConnected(false);
      setStats(ZERO_STATS);
      setClaimableWei(ZERO_BI);
    }
  };

  const handleChainChanged = () => {
    checkNetwork();
    setTimeout(() => window.location.reload(), 450);
  };

  const connectWallet = async () => {
    if (typeof window === "undefined" || !(window as any).ethereum) {
      alert("Please install a wallet like MetaMask.");
      return;
    }

    try {
      const accounts = await (window as any).ethereum.request({ method: "eth_requestAccounts" });
      setAccount(accounts[0]);
      setIsConnected(true);
      await ensureSepoliaNetwork();
    } catch (error: any) {
      console.error("Failed to connect wallet:", error);
      showNotification("error", error?.message || "Wallet connection failed in FHE mode");
    }
  };

  const ensureSepoliaNetwork = async () => {
    if (typeof window === "undefined" || !(window as any).ethereum) return;

    const chainIdHex = `0x${sepolia.id.toString(16)}`;

    try {
      await (window as any).ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: chainIdHex }],
      });
    } catch (switchError: any) {
      if (switchError?.code !== 4902) throw switchError;

      await (window as any).ethereum.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: chainIdHex,
            chainName: sepolia.name,
            nativeCurrency: sepolia.nativeCurrency,
            rpcUrls: sepolia.rpcUrls.default.http,
            blockExplorerUrls: sepolia.blockExplorers?.default
              ? [sepolia.blockExplorers.default.url]
              : undefined,
          },
        ],
      });
    }

    await wait(900);
    await checkNetwork();
  };

  const switchToSepolia = async () => {
    try {
      setIsSwitchingNetwork(true);
      await ensureSepoliaNetwork();
    } catch (error: any) {
      showNotification("error", error?.message || "Failed to switch to the FHE game network");
    } finally {
      setIsSwitchingNetwork(false);
    }
  };

  const getProvider = () => {
    if (typeof window === "undefined" || !(window as any).ethereum) {
      throw new Error("Wallet provider not found");
    }
    return new ethers.BrowserProvider((window as any).ethereum);
  };

  const logTransaction = async ({
    txHash,
    action,
    amountWei,
  }: {
    txHash: string;
    action: "scratch_reward" | "claim";
    amountWei: bigint;
  }) => {
    try {
      await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          walletAddress: account,
          txHash,
          action,
          amountWei: amountWei.toString(),
          chainId: sepolia.id,
          contractAddress: SCRATCH_CARD_ADDRESS,
          occurredAt: new Date().toISOString(),
        }),
      });
    } catch (error) {
      console.warn("Transaction logging failed:", error);
    }
  };

  const getRecentFromBlock = async (provider: ethers.BrowserProvider) => {
    const latestBlock = await provider.getBlockNumber();
    const span = 120_000;
    return BigInt(Math.max(0, latestBlock - span));
  };

  const refreshClaimable = async () => {
    if (!account) {
      setClaimableWei(ZERO_BI);
      return;
    }

    try {
      const provider = getProvider();
      const contract = new ethers.Contract(SCRATCH_CARD_ADDRESS, SCRATCH_CARD_ABI, provider);
      const status = await contract.getClaimStatus(account);
      setClaimableWei(BigInt(status?.claimable ?? status?.[0] ?? ZERO_BI));
    } catch {
      // Keep existing claimable value when call fails.
    }
  };

  const refreshAll = async () => {
    if (!account) return;

    try {
      setIsLoading(true);
      const provider = getProvider();
      const code = await provider.getCode(SCRATCH_CARD_ADDRESS);

      if (code === "0x") {
        throw new Error(
          "Scratch contract not found at configured address. Set NEXT_PUBLIC_SCRATCH_CARD_CONTRACT."
        );
      }

      const contract = new ethers.Contract(SCRATCH_CARD_ADDRESS, SCRATCH_CARD_ABI, provider);
      const fromBlock = await getRecentFromBlock(provider);

      const [price, pendingPlainValue, balance, scratchEvents, rewardEvents] = await Promise.all([
        contract.scratchPrice(),
        contract.totalPendingPlain(),
        provider.getBalance(SCRATCH_CARD_ADDRESS),
        contract.queryFilter(contract.filters.ScratchPlayed(account), fromBlock),
        contract.queryFilter(contract.filters.RewardsClaimed(account), fromBlock),
      ]);

      setScratchPrice(BigInt(price));
      setTotalPendingPlain(BigInt(pendingPlainValue));
      setContractBalance(BigInt(balance));
      const totalWon = scratchEvents.reduce((sum: bigint, evt: any) => {
        const reward = evt?.args?.reward ?? ZERO_BI;
        return sum + BigInt(reward);
      }, ZERO_BI);
      const totalRewarded = rewardEvents.reduce((sum: bigint, evt: any) => {
        const amount = evt?.args?.amount ?? ZERO_BI;
        return sum + BigInt(amount);
      }, ZERO_BI);
      setStats({
        totalRewarded: totalWon,
        scratches: BigInt(scratchEvents.length),
        totalClaimed: totalRewarded,
      });
      await refreshClaimable();
    } catch (error: any) {
      console.error("Failed to fetch game state:", error);
      showNotification("error", error?.message || "Failed to fetch FHE game data");
    } finally {
      setIsLoading(false);
    }
  };

  const waitForRewardsClaimed = async (
    contract: ethers.Contract,
    provider: ethers.BrowserProvider,
    fromBlock: bigint
  ): Promise<ScratchResult | null> => {
    for (let i = 0; i < 24; i++) {
      const latestBlock = await provider.getBlockNumber();
      const events = await contract.queryFilter(contract.filters.RewardsClaimed(account), fromBlock, latestBlock);

      if (events.length > 0) {
        const latest = events[events.length - 1];
        if (!("args" in latest)) {
          await wait(2500);
          continue;
        }

        const parsed = latest.args as { amount?: bigint };
        return {
          reward: BigInt(parsed?.amount ?? 0),
          settledAt: Date.now(),
          payoutTxHash: latest.transactionHash,
        };
      }

      await wait(2500);
    }

    return null;
  };

  const scratchCard = async () => {
    if (!canPlay) {
      showNotification("error", "Connect wallet on Sepolia to enter the FHE privacy flow");
      return;
    }

    try {
      setIsScratching(true);
      setIsProcessingReactivity(true);

      const provider = getProvider();
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(SCRATCH_CARD_ADDRESS, SCRATCH_CARD_ABI, signer);

      const price = BigInt(await contract.scratchPrice());
      const tx = await contract.scratchCard({ value: price });
      setShowScratchCard(false);
      setIsScratchRevealed(false);
      setIsScratchModalOpen(false);
      setLastTxHash(tx.hash);
      setLastScratchTxHash(tx.hash);
      const receipt = await tx.wait();
      const scratchEvent = receipt?.logs
        ?.map((log: any) => {
          try {
            return contract.interface.parseLog(log);
          } catch {
            return null;
          }
        })
        .find((e: any) => e?.name === "ScratchPlayed");
      const rewardWei = BigInt(scratchEvent?.args?.reward ?? ZERO_BI);
      await logTransaction({
        txHash: tx.hash,
        action: "scratch_reward",
        amountWei: rewardWei,
      });
      setLastScratchResult({
        reward: rewardWei,
        settledAt: Date.now(),
        payoutTxHash: undefined,
      });
      setShowScratchCard(true);
      setIsScratchModalOpen(true);
      setIsScratchRevealed(false);
      setScratchSurfaceKey((v) => v + 1);
      showNotification("success", "Scratch recorded. Your result is ready to reveal.");

      await refreshAll();
    } catch (error: any) {
      console.error("Scratch failed:", error);
      showNotification("error", getScratchFailureMessage(error));
    } finally {
      setIsScratching(false);
      setIsProcessingReactivity(false);
    }
  };

  const claimRewards = async () => {
    if (!canPlay) {
      showNotification("error", "Connect wallet on Sepolia to claim through FHE flow");
      return;
    }

    try {
      const amountWei = claimableWei;
      if (amountWei <= ZERO_BI) {
        showNotification("error", "No winnings available to claim yet");
        return;
      }
      if (amountWei > MAX_UINT128) {
        showNotification("error", "FHE claim blocked: amount exceeds uint128 limit");
        return;
      }

      setIsClaimingRewards(true);
      setIsProcessingReactivity(true);

      const provider = getProvider();
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(SCRATCH_CARD_ADDRESS, SCRATCH_CARD_ABI, signer);

      const tx = await contract.claimRewards(amountWei);
      setLastTxHash(tx.hash);
      const receipt = await tx.wait();

      const result = await waitForRewardsClaimed(contract, provider, BigInt(receipt.blockNumber));
      if (result) {
        setLastScratchResult(result);
        setShowScratchCard(true);
        setIsScratchModalOpen(true);
        setScratchSurfaceKey((v) => v + 1);
        if (lastScratchTxHash) {
          await logTransaction({
            txHash: lastScratchTxHash,
            action: "scratch_reward",
            amountWei: result.reward,
          });
        }
        await logTransaction({
          txHash: result.payoutTxHash || tx.hash,
          action: "claim",
          amountWei: result.reward,
        });
        showNotification("success", `FHE-secured rewards claimed: ${formatEth(result.reward)} ETH`);
      } else {
        await logTransaction({
          txHash: tx.hash,
          action: "claim",
          amountWei: amountWei,
        });
        showNotification("success", "FHE claim transaction confirmed on-chain");
      }

      await refreshAll();
    } catch (error: any) {
      console.error("Claim rewards failed:", error);
      showNotification("error", error?.shortMessage || error?.message || "FHE claim flow failed");
    } finally {
      setIsClaimingRewards(false);
      setIsProcessingReactivity(false);
    }
  };

  const showNotification = (type: "success" | "error", message: string) => {
    const div = document.createElement("div");
    div.className = `fixed top-4 right-4 z-50 px-6 py-3 rounded-lg backdrop-blur-sm animate-fade-in ${
      type === "success"
        ? "bg-green-500/10 border border-green-500/30 text-green-500"
        : "bg-red-500/10 border border-red-500/30 text-red-500"
    }`;
    const prefix = type === "success" ? "FHE secure: " : "FHE guard: ";
    div.textContent = `${prefix}${message}`;
    document.body.appendChild(div);
    setTimeout(() => div.remove(), 5000);
  };

  const burstConfetti = () => {
    const colors = ["#876dff", "#22c55e", "#eab308", "#06b6d4", "#f43f5e", "#ffffff"];
    const now = Date.now();
    const pieces: ConfettiPiece[] = Array.from({ length: 90 }).map((_, index) => ({
      id: `${now}-${index}`,
      left: Math.random() * 100,
      size: 6 + Math.random() * 8,
      delay: Math.random() * 0.15,
      duration: 1.6 + Math.random() * 1.4,
      color: colors[Math.floor(Math.random() * colors.length)],
      drift: (Math.random() - 0.5) * 160,
      rotate: Math.random() * 720,
    }));

    setConfettiPieces(pieces);
    setTimeout(() => setConfettiPieces([]), 3000);
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="relative z-10 mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
        {stickerPlacements.map((sticker) => (
          <div
            key={sticker.id}
            className="pointer-events-none absolute -z-10 hidden opacity-80 md:block"
            style={{
              top: sticker.top,
              left: sticker.left,
              transform: `rotate(${sticker.rotateDeg}deg) scale(${sticker.scale})`,
            }}
          >
            <Image
              src={sticker.src}
              alt="Scratch and Win"
              width={sticker.width}
              height={sticker.height}
              className="drop-shadow-[0_10px_30px_rgba(135,109,255,0.28)]"
            />
          </div>
        ))}

        {isConnected && !isCorrectNetwork && (
          <div className="mb-6 rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-4 backdrop-blur-sm">
            <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-yellow-500" />
                <div>
                  <h3 className="mb-1 text-sm font-semibold text-yellow-500">Wrong Network Detected</h3>
                  <p className="text-xs text-gray-400">
                    Switch to Sepolia (Chain ID: {sepolia.id}).
                    {currentChainId ? <span className="ml-1">Current: {currentChainId}</span> : null}
                  </p>
                </div>
              </div>
              <button
                onClick={switchToSepolia}
                disabled={isSwitchingNetwork}
                className="flex items-center gap-2 rounded-lg bg-yellow-500 px-4 py-2 font-medium text-black transition-all disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Network className={`h-4 w-4 ${isSwitchingNetwork ? "animate-spin" : ""}`} />
                {isSwitchingNetwork ? "Switching..." : "Switch to Sepolia"}
              </button>
            </div>
          </div>
        )}

        <div className="mb-8 flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="mb-3 bg-gradient-to-r from-monad-purple to-purple-400 bg-clip-text text-4xl font-bold text-transparent sm:text-5xl">
              Scratch Card FHE Game
            </h1>
            <p className="max-w-2xl text-sm text-gray-400 sm:text-base">
              Full privacy protected by Zama FHEVM. Scratch once (`ScratchPlayed`), reveal the result,
              then claim remaining winnings with `claimRewards` and track `RewardsClaimed`.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {!isConnected ? (
              <button
                onClick={connectWallet}
                className="whitespace-nowrap rounded-lg bg-monad-purple px-6 py-3 font-medium text-white transition-all hover:bg-monad-purple/90"
              >
                Connect Wallet
              </button>
            ) : (
              <div className="flex items-center gap-3">
                <div className="rounded-lg border border-card-border bg-card px-4 py-2">
                  <p className="text-xs text-gray-400">Connected</p>
                  <p className="font-mono text-sm text-monad-purple">
                    {account.slice(0, 6)}...{account.slice(-4)}
                  </p>
                </div>
                <button
                  onClick={refreshAll}
                  disabled={isLoading}
                  className="rounded-lg bg-monad-purple/10 p-3 text-monad-purple transition-colors hover:bg-monad-purple/20 disabled:opacity-60"
                  title="Refresh"
                >
                  <RefreshCw className={`h-5 w-5 ${isLoading ? "animate-spin" : ""}`} />
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-4">
          <MetricCard
            label="Scratch Price"
            value={Number(formatEth(scratchPrice))}
            suffix=" ETH"
            icon={<Ticket className="h-5 w-5" />}
          />
          <MetricCard
            label="Max Reward (5x)"
            value={Number(formatEth(maxReward))}
            suffix=" ETH"
            icon={<Coins className="h-5 w-5" />}
          />
          <MetricCard
            label="Available Liquidity"
            value={Number(formatEth(availableLiquidity))}
            suffix=" ETH"
            icon={<Coins className="h-5 w-5" />}
          />
          <MetricCard
            label="Total Pending Plain"
            value={Number(formatEth(totalPendingPlain))}
            suffix=" ETH"
            icon={<Coins className="h-5 w-5" />}
          />
        </div>

        <div className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-card-border bg-card p-6">
            <h2 className="mb-2 text-xl font-bold text-white">Scratch Action</h2>
            <p className="mb-6 text-sm text-gray-400">
              Buy a scratch card, reveal reward, then claim your remaining amount.
            </p>

            <button
              onClick={scratchCard}
              disabled={!canPlay}
              className="mb-3 flex w-full items-center justify-center gap-2 rounded-lg bg-monad-purple px-4 py-3 text-sm font-semibold text-white transition-all hover:bg-monad-purple/90 disabled:cursor-not-allowed disabled:bg-gray-700 disabled:text-gray-400"
            >
              {isScratching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ticket className="h-4 w-4" />}
              {isScratching ? "Submitting Scratch..." : `Scratch for ${formatEth(scratchPrice)} ETH`}
            </button>

            <button
              onClick={claimRewards}
              disabled={!canClaim}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-cyan-500 px-4 py-3 text-sm font-semibold text-black transition-all hover:bg-cyan-400 disabled:cursor-not-allowed disabled:bg-gray-700 disabled:text-gray-400"
            >
              {isClaimingRewards ? <Loader2 className="h-4 w-4 animate-spin" /> : <Coins className="h-4 w-4" />}
              {isClaimingRewards ? "Claiming..." : `Claim ${formatEth(claimableWei)} ETH`}
            </button>

            {isProcessingReactivity ? (
              <div className="mt-6 rounded-lg border border-yellow-500/35 bg-yellow-500/10 p-4 text-xs text-yellow-200">
                Waiting for on-chain confirmation...
              </div>
            ) : null}
          </div>

          <div className="rounded-2xl border border-card-border bg-card p-6">
            <h2 className="mb-4 text-xl font-bold text-white">Scratch Reveal</h2>
            {!showScratchCard ? (
              <div className="flex h-52 items-center justify-center rounded-2xl border border-dashed border-card-border bg-black/30 px-6 text-center text-sm text-gray-400">
                Sign a scratch transaction to open your scratch card modal.
              </div>
            ) : (
              <div className="flex h-52 flex-col items-center justify-center rounded-2xl border border-card-border bg-black/30 px-6 text-center">
                <p className="mb-3 text-sm text-gray-300">
                  {isScratchRevealed
                    ? "Reward already revealed for latest card."
                    : "Your scratch card is ready in modal."}
                </p>
                <button
                  onClick={() => setIsScratchModalOpen(true)}
                  className="rounded-lg bg-monad-purple px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-monad-purple/90"
                >
                  Open Scratch Card
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-4">
          <MetricCard label="Total Scratches" value={Number(stats.scratches)} />
          <MetricCard label="Total Won" value={Number(formatEth(stats.totalRewarded))} suffix=" ETH" />
          <MetricCard label="Total Claimed" value={Number(formatEth(stats.totalClaimed))} suffix=" ETH" />
          <MetricCard
            label="Last Reward"
            value={Number(formatEth(lastScratchResult?.reward ?? ZERO_BI))}
            suffix=" ETH"
          />
        </div>

        <div className="rounded-xl border border-monad-purple/30 bg-monad-purple/10 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="mb-1 text-sm font-medium text-white">Sepolia</p>
              <p className="text-xs text-gray-400">Contract: {SCRATCH_CARD_ADDRESS}</p>
            </div>
            <a
              href={`https://sepolia.etherscan.io/address/${SCRATCH_CARD_ADDRESS}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm text-monad-purple transition-colors hover:text-monad-purple/80"
            >
              View Contract <ExternalLink className="h-4 w-4" />
            </a>
          </div>
          {lastTxHash ? (
            <a
              href={`https://sepolia.etherscan.io/tx/${lastTxHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex items-center gap-2 text-xs text-gray-300 underline-offset-4 hover:underline"
            >
              Last tx: {lastTxHash.slice(0, 12)}...{lastTxHash.slice(-8)}
              <ExternalLink className="h-3 w-3" />
            </a>
          ) : null}
        </div>

        {showScratchCard && isScratchModalOpen ? (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 px-4">
            <div className="w-full max-w-2xl rounded-2xl border border-card-border bg-black p-5 shadow-2xl">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-bold text-white">Scratch Reveal</h3>
                <button
                  onClick={() => setIsScratchModalOpen(false)}
                  className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-white/10 hover:text-white"
                  aria-label="Close scratch modal"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <ScratchSurface
                isEnabled={showScratchCard}
                resetKey={scratchSurfaceKey}
                rewardText={
                  lastScratchResult
                    ? lastScratchResult.reward === ZERO_BI
                      ? "😢 Better luck next time! 0 ETH"
                      : `You won ${formatEth(lastScratchResult.reward)} ETH`
                    : "Scratch recorded. Claim to settle payout."
                }
                statusText={
                  isScratchRevealed
                    ? "Reward revealed successfully"
                    : lastScratchResult
                    ? "Scratch to reveal your won amount"
                    : `Scratch now. Then click Claim ${formatEth(claimableWei)} ETH.`
                }
                onReveal={() => {
                  setIsScratchRevealed(true);
                  burstConfetti();
                  if (lastScratchResult) {
                    if (lastScratchResult.reward === ZERO_BI) {
                      showNotification("error", "FHE result is private and this round paid 0 ETH.");
                    } else {
                      showNotification(
                        "success",
                        `FHE kept your balance private. You won ${formatEth(lastScratchResult.reward)} ETH`
                      );
                    }
                  } else {
                    showNotification("success", "FHE card unlocked. Claim all winnings to finalize the amount.");
                  }
                }}
              />
            </div>
          </div>
        ) : null}

        {confettiPieces.length > 0 ? (
          <div className="pointer-events-none fixed inset-0 z-[80] overflow-hidden">
            {confettiPieces.map((piece) => (
              <span
                key={piece.id}
                className="absolute top-[-10px] block rounded-sm"
                style={{
                  left: `${piece.left}%`,
                  width: `${piece.size}px`,
                  height: `${piece.size * 0.6}px`,
                  backgroundColor: piece.color,
                  animationName: "confetti-fall",
                  animationDuration: `${piece.duration}s`,
                  animationDelay: `${piece.delay}s`,
                  animationTimingFunction: "ease-out",
                  animationFillMode: "forwards",
                  transform: `translate3d(0,0,0) rotate(0deg)`,
                  ["--drift" as string]: `${piece.drift}px`,
                  ["--rot" as string]: `${piece.rotate}deg`,
                }}
              />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  suffix,
  icon,
}: {
  label: string;
  value: number;
  suffix?: string;
  icon?: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-card-border bg-card p-6">
      <p className="mb-3 flex items-center gap-2 text-sm uppercase tracking-wider text-gray-300">
        {icon}
        {label}
      </p>
      <div className="flex items-end gap-2 text-2xl font-semibold text-white sm:text-3xl">
        <AnimatedNumbers
          animateToNumber={Number.isFinite(value) ? value : 0}
          includeComma
          transitions={(index) => ({
            type: "spring",
            duration: index + 0.3,
          })}
          fontStyle={{
            fontSize: 34,
            fontWeight: 700,
            color: "rgb(255,255,255)",
          }}
        />
        {suffix ? <span className="mb-1 text-base text-gray-300">{suffix}</span> : null}
      </div>
    </div>
  );
}
