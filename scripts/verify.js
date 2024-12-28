const hre = require("hardhat");
const prompts = require("prompts");

async function main() {
    try {
        // Prompt for contract address
        const response = await prompts([
            {
                type: 'text',
                name: 'contractAddress',
                message: 'Enter the contract address to verify:',
                validate: value => value.match(/^0x[a-fA-F0-9]{40}$/) ? true : 'Please enter a valid Ethereum address'
            },
            {
                type: 'select',
                name: 'network',
                message: 'Select the network:',
                choices: [
                    { title: 'Base Mainnet', value: 'base' },
                    { title: 'Base Sepolia', value: 'base-sepolia' }
                ],
            },
        ]);

        if (!response.contractAddress || !response.network) {
            console.log("Verification cancelled");
            return;
        }

        console.log(`\nVerifying contract on ${response.network}...`);
        console.log("Contract address:", response.contractAddress);

        // Verify the contract
        try {
            await hre.run("verify:verify", {
                network: response.network,
                address: response.contractAddress,
                constructorArguments: [], // Add constructor arguments here if your contract has any
            });
            console.log("\n✅ Contract verified successfully!");
            
            // Print explorer links
            const explorerUrl = response.network === 'base' 
                ? 'https://base.blockscout.com'
                : 'https://sepolia-explorer.base.org';
            
            console.log(`\nView your contract at: ${explorerUrl}/address/${response.contractAddress}`);
            
        } catch (error) {
            if (error.message.includes("Already Verified")) {
                console.log("\n⚠️ Contract is already verified");
            } else {
                throw error;
            }
        }

    } catch (error) {
        console.error("\n❌ Error during verification:", error);
        process.exitCode = 1;
    }
}

main();