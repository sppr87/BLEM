# BLMN Presale Owner's Guide
## Contract Management via Etherscan

### Initial Setup

1. **Set the BLMN Token Address**
   - Navigate to "Write Contract" section
   - Find `setBlmnToken` function
   - Input your BLMN token contract address
   - Click "Write"
   - This is required before starting any presale activities

2. **Start First Stage**
   - Find `nextStage` function
   - Input price in USD (with 18 decimals)
   - Example: For $0.0025 per token, input: 2500000000000000
   - Price calculation: desired_price * 10^18
   - Click "Write"
   - This will create Stage 1 and activate it

### Monitoring Sales

1. **Check Current Stage Status**
   - Go to "Read Contract" section
   - Use `getCurrentStage` to view:
     - Current stage ID
     - Current price in USD
     - Total tokens sold in stage
     - Active status

2. **View Total Sales**
   - Check `totalTokensSold` for overall tokens sold
   - Check `totalUSDRaised` for total USD value
   - Check `totalEthRaised` for total ETH collected

3. **Check Individual User Purchases**
   - Use `getUserPurchases`
   - Input user's wallet address
   - View their purchase details:
     - Token amount
     - ETH contributed
     - Purchase timestamp
     - Claim status
     - Stage ID of purchase

### Managing Stages

1. **Moving to Next Stage**
   - When ready for price change:
   - Use `nextStage` function
   - Input new price in USD (18 decimals)
   - This automatically:
     - Deactivates current stage
     - Creates new stage
     - Activates new stage

2. **Get Stage Information**
   - Use `getStageInfo`
   - Input stage ID number
   - View complete stage details

### Fund Management

1. **Withdraw Collected ETH**
   - Use `withdrawETH` function
   - All collected ETH will be sent to owner address
   - Can be done at any time

2. **Withdraw Unsold Tokens**
   - Can only be done after presale ends
   - Use `withdrawUnsoldTokens` function
   - All remaining tokens sent to owner

### Enabling Claims

1. **End Presale and Enable Claims**
   - Use `updatePresaleStatus` function
   - Parameters:
     - ended: true (ends presale)
     - enableClaiming: true (allows token claims)
   - Example: updatePresaleStatus(true, true)

### Emergency Functions

1. **Recover Wrong Tokens**
   - If other tokens are accidentally sent:
   - Use `recoverToken` function
   - Input token contract address
   - Note: Cannot be used for BLMN token

### Common Scenarios

1. **Starting Presale**
   ```
   1. setBlmnToken(token_address)
   2. nextStage(initial_price)
   ```

2. **Changing Price**
   ```
   1. nextStage(new_price)
   ```

3. **Ending Presale**
   ```
   1. updatePresaleStatus(true, true)
   2. withdrawETH() // optional
   3. withdrawUnsoldTokens() // optional
   ```

### Price Conversion Guide

Common USD prices to contract input (18 decimals):
- $0.0025 = 2500000000000000
- $0.003 = 3000000000000000
- $0.0035 = 3500000000000000
- $0.004 = 4000000000000000
- $0.0045 = 4500000000000000
- $0.005 = 5000000000000000

Formula: USD_price × 10^18

### Important Notes

1. Always verify transaction success in Etherscan
2. Keep track of current stage ID
3. Monitor contract ETH balance regularly
4. Test small transactions when starting new stage
5. Cannot undo stage progression
6. Ensure enough tokens are in contract for purchases

### Safety Tips

1. Always double-check addresses before transactions
2. Verify price calculations before creating new stage
3. Test claim functionality with small amount first
4. Keep private keys secure
5. Monitor contract activity regularly
6. Backup all transaction hashes

