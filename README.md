# Scratch Card Game (Zama FHEVM + Sepolia)

This repo contains:

- `onchain-reactivity/`: Solidity contract + Hardhat scripts/tasks
- `scratch-your-card/`: Next.js frontend + leaderboard/profile APIs

## Where Zama FHE is used

Zama FHE is used in the game contract:
- `onchain-reactivity/contracts/ScratchCardFHEVMGame.sol`

It uses:
- `@fhevm/solidity/lib/FHE.sol`
- `@fhevm/solidity/config/ZamaConfig.sol`
- Encrypted state (`euint128`, `euint64`) for `pendingRewards`, `totalWon`, and `scratches`

The contract still exposes plain UI helpers (`getClaimStatus`, `claimableRewards`, `claimedRewards`, `lastScratchReward`) so the app can render claimable and latest result directly.

## Why Zama FHE is used

- Keeps sensitive per-user game values in encrypted form on-chain
- Allows contract-side arithmetic on encrypted values
- Preserves privacy while still keeping settlement/claims verifiable on-chain

In short: users can play and claim normally, while private reward/accounting state is protected by FHE.

## Quick start

### Contract side
```bash
cd onchain-reactivity
pnpm install
pnpm hardhat compile
pnpm hardhat task:scratch-status
```

### Frontend side
```bash
cd scratch-your-card
pnpm install
pnpm dev
```

Create `.env` in frontend:
```env
NEXT_PUBLIC_SCRATCH_CARD_CONTRACT=<deployed_contract_address>
MONGODB_URI=your_mongodb_connection_string
MONGODB_DB=scratch_game
```

Open `http://localhost:3000`.
# zama-scratch-card
