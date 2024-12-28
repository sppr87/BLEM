const hre = require("hardhat");
const prompts = require("prompts");

const ACTIONS = {
    LOCK_TRANSFERS: "lockTransfers",
    UNLOCK_TRANSFERS: "unlockTransfers",
    TRANSFER_OWNERSHIP: "transferOwnership",
    CHECK_STATUS: "checkStatus",
    TRANSFER_TOKENS: "transferTokens",
    GET_BALANCES: "getBalances",
    SET_TRANSFER_LOCK: "setTransferLock"
};

async function getTokenContract(tokenAddress) {
    const Token = await hre.ethers.getContractFactory("BITLMN");
    return Token.attach(tokenAddress);
}

async function getDeployedAddress() {
    try {
        const deployInfo = require('../deployment-info.json');
        return deployInfo.tokenAddress;
    } catch (error) {
        return null;
    }
}

async function main() {
    try {
        // Get the deployer account
        const [deployer] = await hre.ethers.getSigners();
        console.log("Managing token with account:", deployer.address);
        
        // Get action from command line or prompt
        let action = process.argv.find(arg => arg.startsWith("--action="))?.split("=")[1];
        let tokenAddress = process.argv.find(arg => arg.startsWith("--address="))?.split("=")[1];

        if (!tokenAddress) {
            tokenAddress = await getDeployedAddress();
        }

        if (!action || !tokenAddress) {
            const response = await prompts([
                {
                    type: 'select',
                    name: 'action',
                    message: 'Select action to perform:',
                    choices: [
                        { title: 'Lock Transfers', value: ACTIONS.LOCK_TRANSFERS },
                        { title: 'Unlock Transfers', value: ACTIONS.UNLOCK_TRANSFERS },
                        { title: 'Transfer Ownership', value: ACTIONS.TRANSFER_OWNERSHIP },
                        { title: 'Check Status', value: ACTIONS.CHECK_STATUS },
                        { title: 'Transfer Tokens', value: ACTIONS.TRANSFER_TOKENS },
                        { title: 'Get Balances', value: ACTIONS.GET_BALANCES },
                        { title: 'Set Transfer Lock', value: ACTIONS.SET_TRANSFER_LOCK }
                    ]
                },
                {
                    type: prev => !tokenAddress ? 'text' : null,
                    name: 'tokenAddress',
                    message: 'Enter token contract address:',
                    validate: value => value.match(/^0x[a-fA-F0-9]{40}$/) ? true : 'Please enter a valid address'
                }
            ]);

            if (!response.action) {
                console.log("Operation cancelled");
                return;
            }

            action = response.action;
            if (response.tokenAddress) {
                tokenAddress = response.tokenAddress;
            }
        }

        const token = await getTokenContract(tokenAddress);
        console.log("\nToken Contract:", tokenAddress);

        switch (action) {
            case ACTIONS.LOCK_TRANSFERS: {
                const tx = await token.setTransferLock(true);
                await tx.wait();
                console.log("✅ Transfers locked successfully");
                break;
            }

            case ACTIONS.UNLOCK_TRANSFERS: {
                const tx = await token.setTransferLock(false);
                await tx.wait();
                console.log("✅ Transfers unlocked successfully");
                break;
            }

            case ACTIONS.TRANSFER_OWNERSHIP: {
                const { newOwner } = await prompts({
                    type: 'text',
                    name: 'newOwner',
                    message: 'Enter new owner address:',
                    validate: value => value.match(/^0x[a-fA-F0-9]{40}$/) ? true : 'Please enter a valid address'
                });

                if (newOwner) {
                    const tx = await token.transferOwnership(newOwner);
                    await tx.wait();
                    console.log(`✅ Ownership transferred to ${newOwner}`);
                }
                break;
            }

            case ACTIONS.CHECK_STATUS: {
                const owner = await token.owner();
                const totalSupply = await token.totalSupply();
                const transferLocked = await token.transferLocked();
                
                console.log("\nToken Status:");
                console.log("-------------");
                console.log("Owner:", owner);
                console.log("Total Supply:", hre.ethers.formatEther(totalSupply), "BLMN");
                console.log("Transfers Locked:", transferLocked);
                break;
            }

            case ACTIONS.TRANSFER_TOKENS: {
                const response = await prompts([
                    {
                        type: 'text',
                        name: 'recipient',
                        message: 'Enter recipient address:',
                        validate: value => value.match(/^0x[a-fA-F0-9]{40}$/) ? true : 'Please enter a valid address'
                    },
                    {
                        type: 'number',
                        name: 'amount',
                        message: 'Enter amount of tokens to transfer:',
                        validate: value => value > 0 ? true : 'Amount must be greater than 0'
                    }
                ]);

                if (response.recipient && response.amount) {
                    const amount = hre.ethers.parseEther(response.amount.toString());
                    const tx = await token.transfer(response.recipient, amount);
                    await tx.wait();
                    console.log(`✅ Transferred ${response.amount} BLMN to ${response.recipient}`);
                }
                break;
            }

            case ACTIONS.GET_BALANCES: {
                const { address } = await prompts({
                    type: 'text',
                    name: 'address',
                    message: 'Enter address to check balance (or press enter for all reserved addresses):',
                    validate: value => !value || value.match(/^0x[a-fA-F0-9]{40}$/) ? true : 'Please enter a valid address'
                });

                if (address) {
                    const balance = await token.balanceOf(address);
                    console.log(`\nBalance of ${address}: ${hre.ethers.formatEther(balance)} BLMN`);
                } else {
                    // Check all reserved addresses
                    const addresses = {
                        "Presale Reserve": await token.PRESALE_ADDRESS(),
                        "Marketing Reserve": await token.MARKETING_ADDRESS(),
                        "Exchange Reserve": await token.EXCHANGE_ADDRESS(),
                        "Rewards Reserve": await token.REWARDS_ADDRESS(),
                        "Team Reserve": await token.TEAM_ADDRESS()
                    };

                    console.log("\nReserve Balances:");
                    console.log("----------------");
                    for (const [name, addr] of Object.entries(addresses)) {
                        const balance = await token.balanceOf(addr);
                        console.log(`${name}: ${hre.ethers.formatEther(balance)} BLMN`);
                    }
                }
                break;
            }

            case ACTIONS.SET_TRANSFER_LOCK: {
                const { locked } = await prompts({
                    type: 'confirm',
                    name: 'locked',
                    message: 'Should transfers be locked?',
                    initial: false
                });

                const tx = await token.setTransferLock(locked);
                await tx.wait();
                console.log(`✅ Transfer lock set to: ${locked}`);
                break;
            }

            default:
                console.log("Invalid action specified");
        }

    } catch (error) {
        console.error("Error:", error);
        process.exitCode = 1;
    }
}

main();