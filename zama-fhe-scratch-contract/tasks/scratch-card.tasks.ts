import { task } from "hardhat/config";
import type { TaskArguments } from "hardhat/types";
const CONTRACT_NAME = "ScratchCardGameFHE";
function requireAddress(taskArguments: TaskArguments): string {
  const address = "0xcfD8183209ABb5f4c33A14EFc9bb14Da9fAB7Ec6";
  if (!address) {
    throw new Error(
      "Missing contract address. Pass --address <contract> or set SCRATCH_CARD_CONTRACT in .env",
    );
  }
  return address;
}
task("task:scratch-address", "Prints the ScratchCardGameFHE address")
  .addOptionalParam("address", "Optionally specify the deployed contract address")
  .setAction(async function (taskArguments: TaskArguments) {
    const address = requireAddress(taskArguments);
    console.log(`${CONTRACT_NAME} address: ${address}`);
  });

task("task:scratch-status", "Prints key contract state")
  .addOptionalParam("address", "Optionally specify the deployed contract address")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { ethers } = hre;
    const address = requireAddress(taskArguments);
    const contract = await ethers.getContractAt(CONTRACT_NAME, address);

    const [owner, scratchPrice, totalPendingPlain, contractBalance] = await Promise.all([
      contract.owner(),
      contract.scratchPrice(),
      contract.totalPendingPlain(),
      ethers.provider.getBalance(address),
    ]);

    console.log(`${CONTRACT_NAME}: ${address}`);
    console.log(`Owner            : ${owner}`);
    console.log(`Scratch price    : ${scratchPrice.toString()} wei`);
    console.log(`Total pending    : ${totalPendingPlain.toString()} wei`);
    console.log(`Contract balance : ${contractBalance.toString()} wei`);
  });

task("task:claim-status", "Prints caller claimable/claimed/lastReward")
  .addOptionalParam("address", "Optionally specify the deployed contract address")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { ethers } = hre;
    const address = requireAddress(taskArguments);
    const [signer] = await ethers.getSigners();
    const contract = await ethers.getContractAt(CONTRACT_NAME, address);
    const [claimable, claimed, lastReward] = await contract.getClaimStatus(signer.address);

    console.log(`${CONTRACT_NAME}: ${address}`);
    console.log(`Player           : ${signer.address}`);
    console.log(`Claimable        : ${claimable.toString()} wei`);
    console.log(`Claimed          : ${claimed.toString()} wei`);
    console.log(`Last reward      : ${lastReward.toString()} wei`);
  });

task("task:scratch-play", "Calls scratchCard()")
  .addOptionalParam("address", "Optionally specify the deployed contract address")
  .addOptionalParam("value", "ETH value in wei (defaults to current scratchPrice)")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { ethers, fhevm } = hre;
    await fhevm.initializeCLIApi();
    const address = requireAddress(taskArguments);
    const [signer] = await ethers.getSigners();
    const contract = await ethers.getContractAt(CONTRACT_NAME, address);

    const weiValue = taskArguments.value ? BigInt(taskArguments.value) : (await contract.scratchPrice());
    const tx = await contract.connect(signer).scratchCard({ value: weiValue });
    console.log(`Wait for tx: ${tx.hash}...`);
    const receipt = await tx.wait();
    console.log(`tx:${tx.hash} status=${receipt?.status}`);
  });

task("task:claim-rewards", "Caller claims reward amount directly from claimRewards(uint128)")
  .addOptionalParam("address", "Optionally specify the deployed contract address")
  .addParam("amount", "Amount in wei")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { ethers } = hre;
    const address = requireAddress(taskArguments);
    const [signer] = await ethers.getSigners();
    const contract = await ethers.getContractAt(CONTRACT_NAME, address);

    const tx = await contract.connect(signer).claimRewards(BigInt(taskArguments.amount));
    console.log(`Wait for tx: ${tx.hash}...`);
    const receipt = await tx.wait();
    console.log(`tx:${tx.hash} status=${receipt?.status}`);
  });

task("task:withdraw-profit", "Owner withdraws available liquidity")
  .addOptionalParam("address", "Optionally specify the deployed contract address")
  .addParam("amount", "Amount in wei")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { ethers } = hre;
    const address = requireAddress(taskArguments);
    const [ownerSigner] = await ethers.getSigners();
    const contract = await ethers.getContractAt(CONTRACT_NAME, address);

    const tx = await contract.connect(ownerSigner).withdrawProfit(BigInt(taskArguments.amount));
    console.log(`Wait for tx: ${tx.hash}...`);
    const receipt = await tx.wait();
    console.log(`tx:${tx.hash} status=${receipt?.status}`);
  });

task("task:set-scratch-price", "Owner sets new scratch price")
  .addOptionalParam("address", "Optionally specify the deployed contract address")
  .addParam("price", "New scratch price in wei")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { ethers } = hre;
    const address = requireAddress(taskArguments);
    const [ownerSigner] = await ethers.getSigners();
    const contract = await ethers.getContractAt(CONTRACT_NAME, address);

    const tx = await contract.connect(ownerSigner).setScratchPrice(BigInt(taskArguments.price));
    console.log(`Wait for tx: ${tx.hash}...`);
    const receipt = await tx.wait();
    console.log(`tx:${tx.hash} status=${receipt?.status}`);
  });
