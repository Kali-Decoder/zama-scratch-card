import hre, { ethers } from "hardhat";

const HARDHAT_CHAIN_ID = 31337n;
const SEPOLIA_CHAIN_ID = 11155111n;

function resolveGameAddress(): string {
  const address = process.env.SCRATCH_CARD_CONTRACT ?? process.env.SCRATCH_GAME_ADDRESS;
  if (!address) {
    throw new Error(
      "Missing contract address. Set SCRATCH_CARD_CONTRACT (preferred) or SCRATCH_GAME_ADDRESS in .env",
    );
  }
  return address;
}

function assertSupportedChain(chainId: bigint): void {
  if (chainId !== HARDHAT_CHAIN_ID && chainId !== SEPOLIA_CHAIN_ID) {
    throw new Error(
      `Unsupported network chainId=${chainId.toString()}. Use localhost (31337) or sepolia (11155111).`,
    );
  }
}

async function main() {
  const gameAddress = resolveGameAddress();
  await hre.fhevm.initializeCLIApi();
  const [player] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  const chainId = BigInt(network.chainId.toString());

  assertSupportedChain(chainId);

  const code = await ethers.provider.getCode(gameAddress);
  if (code === "0x") {
    throw new Error(`No contract deployed at ${gameAddress} on chainId=${chainId.toString()}`);
  }

  const game = await ethers.getContractAt("ScratchCardGameFHE", gameAddress, player);

  const [owner, scratchPrice, totalPendingBefore, playerBalanceBefore, contractBalanceBefore] = await Promise.all([
    game.owner(),
    game.scratchPrice(),
    game.totalPendingPlain(),
    ethers.provider.getBalance(player.address),
    ethers.provider.getBalance(gameAddress),
  ]);

  if (playerBalanceBefore < scratchPrice) {
    throw new Error(
      `Insufficient player balance for scratch price. balance=${playerBalanceBefore.toString()} price=${scratchPrice.toString()}`,
    );
  }

  console.log("=".repeat(80));
  console.log("[test-scratch] Start");
  console.log("[network] chainId:", chainId.toString());
  console.log("[network] name:", network.name);
  console.log("[actor] player:", player.address);
  console.log("[contract] address:", gameAddress);
  console.log("[contract] owner:", owner);
  console.log("[state] scratchPrice (wei):", scratchPrice.toString());
  console.log("[state] totalPendingPlain before:", totalPendingBefore.toString());
  console.log("[balances] player before (wei):", playerBalanceBefore.toString());
  console.log("[balances] contract before (wei):", contractBalanceBefore.toString());
  console.log("-".repeat(80));

  const scratchTx = await game.connect(player).scratchCard({ value: scratchPrice });
  console.log("[tx] scratchCard:", scratchTx.hash);
  const scratchReceipt = await scratchTx.wait();
  console.log("[receipt] scratchCard status:", scratchReceipt?.status ?? "n/a");
  console.log("[receipt] scratchCard gasUsed:", scratchReceipt?.gasUsed.toString() ?? "n/a");

  const [claimableMid, claimedMid, lastRewardMid] = await game.getClaimStatus(player.address);
  const totalPendingMid = await game.totalPendingPlain();
  console.log("[state] claimable after scratch:", claimableMid.toString());
  console.log("[state] claimed after scratch:", claimedMid.toString());
  console.log("[state] lastReward after scratch:", lastRewardMid.toString());
  console.log("[state] totalPendingPlain after scratch:", totalPendingMid.toString());

  if (claimableMid > 0n) {
    const claimAmount = claimableMid;
    const claimTx = await game.connect(player).claimRewards(claimAmount);
    console.log("[tx] claimRewards:", claimTx.hash);
    const claimReceipt = await claimTx.wait();
    console.log("[receipt] claimRewards status:", claimReceipt?.status ?? "n/a");
    console.log("[receipt] claimRewards gasUsed:", claimReceipt?.gasUsed.toString() ?? "n/a");
  } else {
    console.log("[tx] claimRewards skipped: totalPendingPlain is 0");
  }

  const [totalPendingAfter, playerBalanceAfter, contractBalanceAfter] = await Promise.all([
    game.totalPendingPlain(),
    ethers.provider.getBalance(player.address),
    ethers.provider.getBalance(gameAddress),
  ]);

  console.log("-".repeat(80));
  console.log("[state] totalPendingPlain after:", totalPendingAfter.toString());
  console.log("[balances] player after (wei):", playerBalanceAfter.toString());
  console.log("[balances] contract after (wei):", contractBalanceAfter.toString());
  console.log("[delta] player (wei):", (playerBalanceAfter - playerBalanceBefore).toString());
  console.log("[delta] contract (wei):", (contractBalanceAfter - contractBalanceBefore).toString());
  console.log("[summary] scratchCard success: true");
  console.log("[summary] claimable flow checked: true");
  console.log("[test-scratch] Complete");
  console.log("=".repeat(80));
}

main();
