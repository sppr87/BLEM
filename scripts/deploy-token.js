const hre = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-toolbox/network-helpers");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);
  
  // Store allocation addresses
  const allocationAddresses = {
    presale: "0xb216a15E39971fCEE8da49613610F49BE69f98E6",    // 55%
    marketing: "0x3789acc9fA510edae2549728FF0D1cE8Df472093",   // 12%
    exchange: "0xdBF0CB4389546dBe8579828fb2EF0355D433d5fb",    // 10%
    rewards: "0xc23616c729b12f2aC466dA11CC88E14a049fd8F5",     // 18%
    team: "0x2D1e5D1fB870C92f87251131c993B64770581Da4",        // 5%
    burn: "0xFC7416d81C7F0C1A4f949c014b41434f80D39eAf"         // Burn address
  };

  // Deploy Token Contract
  console.log("\nDeploying BLMN Token...");
  const BLMN = await hre.ethers.getContractFactory("BLMN");
  const token = await BLMN.deploy(
    allocationAddresses.presale,    // presale - 55%
    allocationAddresses.marketing,  // marketing - 12%
    allocationAddresses.exchange,   // exchange - 10%
    allocationAddresses.rewards,    // rewards - 18%
    allocationAddresses.team,       // team - 5%
    allocationAddresses.burn        // burn address
  );

  await token.waitForDeployment();
  const tokenAddress = await token.getAddress();
  console.log("BLMN Token deployed to:", tokenAddress);

  // Log deployment details
  console.log("\nDeployment Summary:");
  console.log("-------------------");
  console.log("Token Contract:", tokenAddress);
  console.log("\nToken Allocations:");
  console.log("Presale (55%):", allocationAddresses.presale);
  console.log("Marketing (12%):", allocationAddresses.marketing);
  console.log("Exchange (10%):", allocationAddresses.exchange);
  console.log("Rewards (18%):", allocationAddresses.rewards);
  console.log("Team (5%):", allocationAddresses.team);
  console.log("Burn Address:", allocationAddresses.burn);

  // Wait for a few block confirmations
  console.log("\nWaiting for block confirmations...");
  await token.deploymentTransaction().wait(6);

  // Verify contract on Basescan if not on a local network
  if (hre.network.name !== "hardhat" && hre.network.name !== "localhost") {
    console.log("\nVerifying contract on Basescan...");
    
    try {
      await hre.run("verify:verify", {
        address: tokenAddress,
        constructorArguments: [
          allocationAddresses.presale,
          allocationAddresses.marketing,
          allocationAddresses.exchange,
          allocationAddresses.rewards,
          allocationAddresses.team,
          allocationAddresses.burn
        ]
      });
      console.log("Contract verification completed");
    } catch (error) {
      console.log("Verification error:", error.message);
    }
  }

  // Additional deployment info
  console.log("\nAdditional Information:");
  console.log("----------------------");
  console.log("Network:", hre.network.name);
  console.log("Block number:", await hre.ethers.provider.getBlockNumber());
  console.log("Gas price:", (await hre.ethers.provider.getFeeData()).gasPrice);
}

// Handle errors appropriately
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Deployment failed:", error);
    process.exit(1);
  });