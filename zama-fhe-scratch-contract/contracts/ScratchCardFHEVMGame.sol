// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@fhevm/solidity/lib/FHE.sol";
import "@fhevm/solidity/config/ZamaConfig.sol";

contract ScratchCardGameFHE is ZamaEthereumConfig {

    /*//////////////////////////////////////////////////////////////
                                EVENTS
    //////////////////////////////////////////////////////////////*/

    event ScratchPlayed(address indexed player, uint128 reward, uint128 claimableAfter);
    event RewardsClaimed(address indexed player, uint256 amount);
    event OwnerWithdraw(address indexed owner, uint256 amount);

    /*//////////////////////////////////////////////////////////////
                                STATE
    //////////////////////////////////////////////////////////////*/

    address public immutable owner;
    uint256 public scratchPrice;
    uint256 public totalPendingPlain;

    mapping(address => euint128) private pendingRewards;
    mapping(address => euint128) private totalWon;
    mapping(address => euint64) private scratches;
    mapping(address => uint128) public claimableRewards;
    mapping(address => uint128) public claimedRewards;
    mapping(address => uint128) public lastScratchReward;

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }

    constructor(uint256 _price) {
        owner = msg.sender;
        scratchPrice = _price;
    }

    receive() external payable {}

    /*//////////////////////////////////////////////////////////////
                                GAME
    //////////////////////////////////////////////////////////////*/

    function scratchCard() external payable {
        require(msg.value == scratchPrice, "Wrong price");

        uint256 randomWord =
            uint256(
                keccak256(
                    abi.encodePacked(
                        block.prevrandao,
                        msg.sender,
                        block.timestamp,
                        address(this)
                    )
                )
            );

        uint256 rewardPlain = _rewardFromRandom(randomWord);

        uint256 available = _availableLiquidity();
        if (rewardPlain > available) rewardPlain = available;

        totalPendingPlain += rewardPlain;

        require(rewardPlain <= type(uint128).max, "Overflow");
        uint128 rewardPlain128 = uint128(rewardPlain);
        claimableRewards[msg.sender] += rewardPlain128;
        lastScratchReward[msg.sender] = rewardPlain128;

        euint128 reward = FHE.asEuint128(rewardPlain128);
        reward = FHE.allowThis(reward);

        euint128 currentPending = pendingRewards[msg.sender];
        if (!FHE.isInitialized(currentPending)) {
            currentPending = FHE.asEuint128(0);
            currentPending = FHE.allowThis(currentPending);
        }
        pendingRewards[msg.sender] = FHE.add(currentPending, reward);
        FHE.allowThis(pendingRewards[msg.sender]);
        FHE.allow(pendingRewards[msg.sender], msg.sender);

        euint128 currentTotalWon = totalWon[msg.sender];
        if (!FHE.isInitialized(currentTotalWon)) {
            currentTotalWon = FHE.asEuint128(0);
            currentTotalWon = FHE.allowThis(currentTotalWon);
        }
        totalWon[msg.sender] = FHE.add(currentTotalWon, reward);
        FHE.allowThis(totalWon[msg.sender]);

        euint64 currentScratches = scratches[msg.sender];
        if (!FHE.isInitialized(currentScratches)) {
            currentScratches = FHE.asEuint64(0);
            currentScratches = FHE.allowThis(currentScratches);
        }
        euint64 oneScratch = FHE.asEuint64(1);
        oneScratch = FHE.allowThis(oneScratch);
        scratches[msg.sender] = FHE.add(currentScratches, oneScratch);
        FHE.allowThis(scratches[msg.sender]);

        emit ScratchPlayed(msg.sender, rewardPlain128, claimableRewards[msg.sender]);
    }

    /*//////////////////////////////////////////////////////////////
                        CLAIM DIRECTLY
    //////////////////////////////////////////////////////////////*/

    function claimRewards(uint128 amount) external {
        require(amount > 0, "Zero amount");
        require(amount <= claimableRewards[msg.sender], "Exceeds claimable");
        require(amount <= totalPendingPlain, "Pool empty");

        claimableRewards[msg.sender] -= amount;
        claimedRewards[msg.sender] += amount;
        totalPendingPlain -= amount;

        (bool sent,) = payable(msg.sender).call{value: amount}("");
        require(sent, "Transfer failed");

        emit RewardsClaimed(msg.sender, amount);
    }

    function getClaimStatus(address player)
        external
        view
        returns (uint128 claimable, uint128 claimed, uint128 lastReward)
    {
        return (
            claimableRewards[player],
            claimedRewards[player],
            lastScratchReward[player]
        );
    }

    /*//////////////////////////////////////////////////////////////
                        OWNER
    //////////////////////////////////////////////////////////////*/

    function withdrawProfit(uint256 amount)
        external
        onlyOwner
    {
        uint256 available = _availableLiquidity();
        require(amount <= available, "Too much");

        (bool sent,) = payable(owner).call{value: amount}("");
        require(sent);

        emit OwnerWithdraw(owner, amount);
    }

    function setScratchPrice(uint256 newPrice)
        external
        onlyOwner
    {
        scratchPrice = newPrice;
    }

    /*//////////////////////////////////////////////////////////////
                        REWARD MODEL
    //////////////////////////////////////////////////////////////*/

    function _rewardFromRandom(uint256 r)
        internal
        view
        returns (uint256)
    {
        uint256 roll = r % 10000;

        if (roll < 5500) return 0;
        if (roll < 7500) return scratchPrice;
        if (roll < 8500) return scratchPrice * 2;
        if (roll < 9200) return scratchPrice * 3;
        if (roll < 9700) return scratchPrice * 4;
        return scratchPrice * 5;
    }

    function _availableLiquidity()
        internal
        view
        returns (uint256)
    {
        uint256 bal = address(this).balance;
        if (bal <= totalPendingPlain) return 0;
        return bal - totalPendingPlain;
    }
}
