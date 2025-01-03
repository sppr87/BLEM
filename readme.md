# BITLMN Token and Presale Contracts

This repository contains smart contracts for the BITLMN token and its presale implementation on the Base network. The system consists of two main contracts: the BITLMN ERC20 token and a multi-stage presale contract.

## Table of Contents
- [Overview](#overview)
  - [BITLMN Token Distribution](#bitlmn-token-distribution)
  - [Token Vesting](#token-vesting)
    - [Vesting Schedules](#vesting-schedules)
    - [Interacting with Vesting](#interacting-with-vesting)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Deployment](#deployment)
- [Contract Management](#contract-management)
  - [Token Management](#token-management)
  - [Presale Management](#presale-management)
- [Presale Stages](#presale-stages)
- [Common Operations](#common-operations)
- [Security Considerations](#security-considerations)

## Overview

### BITLMN Token Distribution
- Total Supply: 1,000,000,000 BLMN
- Presale: 550,000,000 BLMN (55%)
- Marketing: 120,000,000 BLMN (12%)
- Exchange Listings: 100,000,000 BLMN (10%)
- Rewards: 180,000,000 BLMN (18%)
- Team & Advisors: 50,000,000 BLMN (5%)

### Token Vesting
The project implements a comprehensive vesting system for different token allocations through the BLMNVesting contract. Each allocation has its own vesting schedule designed to ensure long-term project sustainability.

#### Vesting Schedules

1. Team & Advisors (5% - 50,000,000 BLMN)
   - 12 months cliff period
   - 24 months linear vesting after cliff
   - No initial unlock

2. Marketing (12% - 120,000,000 BLMN)
   - No cliff period
   - 18 months linear vesting
   - 20% initial unlock at schedule creation

3. Rewards (18% - 180,000,000 BLMN)
   - Special vesting structure:
   - First 6 months: Linear release of initial 10%
   - Remaining 30 months: Linear release of remaining 90%
   - Total vesting period: 36 months

4. Exchange Listings (10% - 100,000,000 BLMN)
   - 6 months cliff period
   - Instant unlock after cliff period
   - No initial unlock

#### Interacting with Vesting

1. Creating Vesting Schedules
```javascript
// Only owner can create schedules
await vestingContract.createTeamSchedule();
await vestingContract.createMarketingSchedule();
await vestingContract.createRewardsSchedule();
await vestingContract.createExchangeSchedule();
```

2. Checking Vesting Status
```javascript
// Get schedule information
const teamSchedule = await vestingContract.getVestingSchedule(
    await vestingContract.TEAM_SCHEDULE()
);

// Calculate releasable amount
const releasable = await vestingContract.calculateReleasableAmount(
    await vestingContract.TEAM_SCHEDULE()
);
```

3. Releasing Vested Tokens
```javascript
// Release available tokens for a schedule
await vestingContract.release(await vestingContract.TEAM_SCHEDULE());
```

### Presale Stages
1. Seed Stage
2. Private Stage
3. Public Stage

## Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- An Ethereum wallet with Base network ETH for deployment
- Base RPC URL (from Alchemy, Infura, or other providers)

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd bitlmn-contracts
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file:
```env
PRIVATE_KEY=your_private_key_here
ETHERSCAN_API_KEY=your_basescan_api_key_here
ALCHEMY_API_KEY=your_alchemy_api_key_here
```

## Deployment

### Test Network Deployment (Base Sepolia)
```bash
npx hardhat run scripts/deploy-all.js --network base-sepolia
```

### Main Network Deployment (Base Mainnet)
```bash
npx hardhat run scripts/deploy-all.js --network base
```

The deployment script will:
1. Deploy the BITLMN token contract
2. Deploy the presale contract
3. Deploy the vesting contract
4. Configure the presale contract with the token address
5. Configure the vesting contract with the token address
6. Transfer tokens to the presale and vesting contracts
7. Verify all contracts on BaseScan
8. Save deployment information to `deployment-info.json`

## Contract Management

### Token Management

#### Transfer Lock
```bash
# Lock token transfers
npx hardhat run scripts/manage-token.js --network base-sepolia --action lockTransfers

# Unlock token transfers
npx hardhat run scripts/manage-token.js --network base-sepolia --action unlockTransfers
```

### Presale Management

#### Setting Token Address
```javascript
// If you need to set/update the token address
const tokenAddress = "0x...";
await presaleContract.setBITLMNToken(tokenAddress);
```

#### Managing Presale Stages

1. Change Presale Stage:
```javascript
// Stages:
// 0 = Paused
// 1 = Seed
// 2 = Private
// 3 = Public
await presaleContract.setPresaleStage(1); // Set to Seed stage
```

2. Update Stage Information:
```javascript
// Parameters:
// - Stage number (1-3)
// - Price in wei (ETH)
// - Minimum purchase amount
// - Maximum purchase amount
// - Stage maximum tokens
await presaleContract.updateStageInfo(
    1, // Seed stage
    ethers.parseEther("0.0000075"), // 0.0000075 ETH per token
    10000, // Min purchase: 10,000 tokens
    1000000, // Max purchase: 1,000,000 tokens
    ethers.parseEther("100000000") // Stage cap: 100M tokens
);
```

3. Default Stage Configurations:

Seed Stage:
```javascript
{
    price: ethers.parseEther("0.0000075"),
    minPurchase: 10000,
    maxPurchase: 1000000,
    maxTokens: ethers.parseEther("100000000")
}
```

Private Stage:
```javascript
{
    price: ethers.parseEther("0.000011"),
    minPurchase: 5000,
    maxPurchase: 500000,
    maxTokens: ethers.parseEther("200000000")
}
```

Public Stage:
```javascript
{
    price: ethers.parseEther("0.000015"),
    minPurchase: 1000,
    maxPurchase: 100000,
    maxTokens: ethers.parseEther("250000000")
}
```

#### Withdrawing Funds and Tokens

1. Withdraw collected ETH:
```javascript
await presaleContract.withdrawETH();
```

2. Withdraw unsold tokens:
```javascript
await presaleContract.withdrawUnsoldTokens();
```

## Common Operations

### Check Presale Status
```javascript
// Get current stage
const stage = await presaleContract.getCurrentStageInfo();

// Get total tokens sold
const tokensSold = await presaleContract.totalTokensSold();

// Get total ETH raised
const ethRaised = await presaleContract.totalEthRaised();
```

### User Participation
```javascript
// Get user's purchase info
const userInfo = await presaleContract.userInfo(userAddress);

// Purchase tokens
const price = await presaleContract.getCurrentStageInfo().price;
const tokenAmount = 10000; // Amount of tokens to purchase
const cost = price.mul(tokenAmount);
await presaleContract.purchaseTokens(tokenAmount, { value: cost });

// Claim tokens
await presaleContract.claimTokens();
```

## Security Considerations

1. Always verify contract addresses after deployment
2. Test all stage transitions before enabling them
3. Keep the deployer's private key secure
4. Monitor the presale contract's token and ETH balance
5. Test withdraw functions with small amounts first
6. Verify user's purchase and claim information regularly

## Support

For technical support or questions, please contact [Your Contact Information].

## License

MIT License - See LICENSE.md for details
