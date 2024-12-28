const hre = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);

  // Token distribution configuration
  const TOKEN_DISTRIBUTION = {
    presale: {
      address: deployer.address, // Will be updated to presale contract
      percentage: "55%"
    },
    marketing: {
      address: "0xb995f76a7AA248127F44Aa34557843941B1EbdC8",
      percentage: "12%"
    },
    exchange: {
      address: "0xa5b5465Da3AB69Ab1064b158e455f2188a246be0",
      percentage: "10%"
    },
    rewards: {
      address: "0xF0640817930d964D7FfC8d483f444448625F8941",
      percentage: "18%"
    },
    team: {
      address: "0xa93860F8190b7d196f4Ead7aFc7B146Cf2CEbDB9",
      percentage: "5%"
    },
    burn: {
      address: "0x000000000000000000000000000000000000dEaD",
      percentage: "0%" // For future burns
    }
  };

  // Validate addresses
  Object.entries(TOKEN_DISTRIBUTION).forEach(([key, value]) => {
    if (!value.address || value.address === ethers.ZeroAddress) {
      throw new Error(`Invalid ${key} address: ${value.address}`);
    }
  });

  // Deploy Presale Contract first
  console.log("Deploying BITLMNPresale...");
  const BITLMNPresale = await hre.ethers.getContractFactory("BLMNPresale");
  // Pass address(0) to let the contract determine the correct price feed based on chainId
  const presale = await BITLMNPresale.deploy("0xa93860F8190b7d196f4Ead7aFc7B146Cf2CEbDB9");
  await presale.waitForDeployment();
  console.log("BITLMNPresale deployed to:", presale.target);

  // Update presale address in distribution
  TOKEN_DISTRIBUTION.presale.address = presale.target;

  // Deploy Token Contract
  console.log("Deploying BITLMN Token...");
  const BITLMN = await hre.ethers.getContractFactory("BLMN");
  const token = await BITLMN.deploy(
    TOKEN_DISTRIBUTION.presale.address,    // presale - 55%
    TOKEN_DISTRIBUTION.marketing.address,  // marketing - 12%
    TOKEN_DISTRIBUTION.exchange.address,   // exchange - 10%
    TOKEN_DISTRIBUTION.rewards.address,    // rewards - 18%
    TOKEN_DISTRIBUTION.team.address,       // team - 5%
    TOKEN_DISTRIBUTION.burn.address        // burn - for future burns
  );
  await token.waitForDeployment();
  console.log("BITLMN Token deployed to:", token.target);

  // Set token address in presale contract
  console.log("Setting token address in presale contract...");
  await presale.setBlmnToken(token.target);
  console.log("Token address set in presale contract");

  console.log("\nDeployment Summary:");
  console.log("-------------------");
  console.log("Presale Contract:", presale.target);
  console.log("Token Contract:", token.target);
  console.log("\nToken Distribution:");
  console.log("-------------------");
  Object.entries(TOKEN_DISTRIBUTION).forEach(([key, value]) => {
    console.log(`${key} (${value.percentage}):`, value.address);
  });

  // Verify contracts on Etherscan
  if (hre.network.name !== "hardhat" && hre.network.name !== "localhost") {
    console.log("\nVerifying contracts on Etherscan...");
    
    console.log("Waiting for block confirmations...");
    // Wait for 5 block confirmations
    await presale.deploymentTransaction().wait(5);

    await hre.run("verify:verify", {
      address: presale.target,
      constructorArguments: ["0xa93860F8190b7d196f4Ead7aFc7B146Cf2CEbDB9"]
    });

    // Wait for 5 block confirmations for token contract
    await token.deploymentTransaction().wait(5);

    await hre.run("verify:verify", {
      address: token.target,
      constructorArguments: [
        TOKEN_DISTRIBUTION.presale.address,
        TOKEN_DISTRIBUTION.marketing.address,
        TOKEN_DISTRIBUTION.exchange.address,
        TOKEN_DISTRIBUTION.rewards.address,
        TOKEN_DISTRIBUTION.team.address,
        TOKEN_DISTRIBUTION.burn.address
      ]
    });
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
