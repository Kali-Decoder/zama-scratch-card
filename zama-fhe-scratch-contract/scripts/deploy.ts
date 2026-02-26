import { ethers } from "hardhat";

async function main() {
  const rawScratchPrice = process.env.SCRATCH_PRICE_WEI ?? ethers.parseEther("0.001").toString();
  const scratchPrice = BigInt(rawScratchPrice);

  console.log("Starting deployment of ScratchCardGameFHE...");
  console.log("Scratch price (wei):", scratchPrice.toString());

  const [deployer] = await ethers.getSigners();
  if (!deployer) {
    throw new Error(
      "No deployer signer found for this network. For Sepolia, set PRIVATE_KEY in .env (0x-prefixed) and ensure hardhat.config.ts loads dotenv."
    );
  }

  const ScratchCardGameFHE = await ethers.getContractFactory("ScratchCardGameFHE", deployer);

  console.log("Deploying contract...");
  const game = await ScratchCardGameFHE.deploy(scratchPrice);

  await game.waitForDeployment();

  const address = await game.getAddress();
  const network = await ethers.provider.getNetwork();

  console.log("✅ ScratchCardGameFHE deployed to:", address);
  console.log("\nDeployment Details:");
  console.log("-------------------");
  console.log("Contract Address:", address);
  console.log("Network:", network.name);
  console.log("Chain ID:", network.chainId);
  console.log("Deployer:", deployer.address);
  console.log("Scratch Price:", scratchPrice.toString(), "wei");

  console.log("\nVerify contract with:");
  console.log(`npx hardhat verify --network sepolia ${address} "${scratchPrice.toString()}"`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Deployment failed:");
    console.error(error);
    process.exitCode = 1;
  });
