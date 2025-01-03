const hre = require("hardhat");
const prompts = require("prompts");

// Token distribution addresses
// Deployed contract addresses
const DEPLOYED_CONTRACTS = {
    presale: "0xff67607023d57b8C4EBFBD672aDeF725e9aA4b79",
    token: "0x44444E0c83750087FcFC27a26660334c6f8C18DA",
    vesting: "0x5aD47b535f0589C51A161b53F502c4092775fE37"
};

// Token distribution addresses
const TOKEN_DISTRIBUTION = {
    presale: DEPLOYED_CONTRACTS.presale,
    marketing: "0xb995f76a7AA248127F44Aa34557843941B1EbdC8",
    exchange: "0xa5b5465Da3AB69Ab1064b158e455f2188a246be0",
    rewards: "0xF0640817930d964D7FfC8d483f444448625F8941",
    team: "0xa93860F8190b7d196f4Ead7aFc7B146Cf2CEbDB9",
    burn: "0x000000000000000000000000000000000000dEaD"
};

async function main() {
    try {
        // Prompt only for contract type
        const response = await prompts({
            type: 'select',
            name: 'contractType',
            message: 'Select the contract type to verify:',
            choices: [
                { title: 'BLMNPresale', value: 'presale' },
                { title: 'BLMN Token', value: 'token' },
                { title: 'BLMNVesting', value: 'vesting' }
            ],
        });

        if (!response.contractType) {
            console.log("Verification cancelled");
            return;
        }

        const contractAddress = DEPLOYED_CONTRACTS[response.contractType];
        console.log(`\nVerifying contract on base-sepolia...`);
        console.log("Contract address:", contractAddress);

        // Prepare constructor arguments based on contract type
        let constructorArguments = [];
        switch (response.contractType) {
            case 'presale':
                constructorArguments = [TOKEN_DISTRIBUTION.team]; // Team wallet address
                break;
            case 'token':
                constructorArguments = [
                    TOKEN_DISTRIBUTION.presale,
                    TOKEN_DISTRIBUTION.marketing,
                    TOKEN_DISTRIBUTION.exchange,
                    TOKEN_DISTRIBUTION.rewards,
                    TOKEN_DISTRIBUTION.team,
                    TOKEN_DISTRIBUTION.burn
                ];
                break;
            case 'vesting':
                constructorArguments = [DEPLOYED_CONTRACTS.token];
                break;
        }

        // Verify the contract
        try {
            // Remove network from verify:verify arguments as it's already set by --network flag
            await hre.run("verify:verify", {
                address: contractAddress,
                constructorArguments: constructorArguments,
                contract: response.contractType === 'presale' ? 'contracts/BITLMNPresale.sol:BLMNPresale' :
                         response.contractType === 'token' ? 'contracts/BITLMN.sol:BLMN' :
                         'contracts/BLMNVesting.sol:BLMNVesting'
            });
            console.log("\n✅ Contract verified successfully!");
            
            // Print explorer links
            console.log(`\nView your contract at: https://sepolia-explorer.base.org/address/${contractAddress}`);
            
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
