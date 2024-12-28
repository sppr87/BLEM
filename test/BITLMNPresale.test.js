const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

describe("BITLMN Presale", function () {
  async function deployPresaleFixture() {
    const [owner, token, buyer1, buyer2, buyer3] = await ethers.getSigners();

    // Deploy mock price feed
    const MockV3Aggregator = await ethers.getContractFactory("MockV3Aggregator");
    const mockPriceFeed = await MockV3Aggregator.deploy(8, ethers.parseUnits("2000", 8)); // $2000 USD/ETH with 8 decimals

    // Deploy presale contract
    const BLMNPresale = await ethers.getContractFactory("BLMNPresale");
    const presale = await BLMNPresale.deploy(await mockPriceFeed.getAddress());

    // Deploy mock token for testing
    const MockToken = await ethers.getContractFactory("MockERC20");
    const blmnToken = await MockToken.deploy("BLMN Token", "BLMN");

    // Configure presale contract
    await presale.setBlmnToken(await blmnToken.getAddress());

    // Transfer tokens to presale contract
    const presaleTokens = ethers.parseEther("1000000"); // 1M tokens
    await blmnToken.transfer(await presale.getAddress(), presaleTokens);

    return {
      presale,
      blmnToken,
      owner,
      buyer1,
      buyer2,
      buyer3,
      presaleTokens,
    };
  }

  describe("Deployment & Setup", function () {
    it("Should deploy with correct initial state", async function () {
      const { presale } = await loadFixture(deployPresaleFixture);
      expect(await presale.currentStageId()).to.equal(0);
    });

    it("Should set token address correctly", async function () {
      const { presale, blmnToken } = await loadFixture(deployPresaleFixture);
      expect(await presale.blmnToken()).to.equal(await blmnToken.getAddress());
    });

    it("Should have correct presale token balance", async function () {
      const { presale, blmnToken, presaleTokens } = await loadFixture(
        deployPresaleFixture
      );
      const balance = await blmnToken.balanceOf(await presale.getAddress());
      expect(balance).to.equal(presaleTokens);
    });
  });

  describe("Stage Management", function () {
    it("Should allow owner to create new stage", async function () {
      const { presale, owner } = await loadFixture(deployPresaleFixture);
      const priceUSD = ethers.parseEther("0.0025"); // $0.0025 USD
      
      await expect(presale.connect(owner).nextStage(priceUSD))
        .to.emit(presale, "StageCreated")
        .withArgs(1, priceUSD);
        
      const stage = await presale.stages(1);
      expect(stage.priceUSD).to.equal(priceUSD);
      expect(stage.active).to.be.true;
    });

    it("Should prevent non-owner from creating stages", async function () {
      const { presale, buyer1 } = await loadFixture(deployPresaleFixture);
      const priceUSD = ethers.parseEther("0.0025");
      
      await expect(
        presale.connect(buyer1).nextStage(priceUSD)
      ).to.be.revertedWithCustomError(presale, "OwnableUnauthorizedAccount");
    });

    it("Should deactivate previous stage when creating new one", async function () {
      const { presale, owner } = await loadFixture(deployPresaleFixture);
      
      // Create first stage
      await presale.connect(owner).nextStage(ethers.parseEther("0.0025"));
      
      // Create second stage
      await presale.connect(owner).nextStage(ethers.parseEther("0.003"));
      
      const stage1 = await presale.stages(1);
      expect(stage1.active).to.be.false;
      
      const stage2 = await presale.stages(2);
      expect(stage2.active).to.be.true;
    });
  });

  describe("Token Purchase", function () {
    it("Should allow token purchase in active stage", async function () {
      const { presale, owner, buyer1 } = await loadFixture(deployPresaleFixture);

      // Create and activate first stage
      const priceUSD = ethers.parseEther("0.0025"); // $0.0025 per token
      await presale.connect(owner).nextStage(priceUSD);
      
      const tokenAmount = ethers.parseEther("1000"); // 1000 tokens
      const ethPrice = ethers.parseUnits("2000", 8); // $2000/ETH with 8 decimals (like Chainlink)
      
      // Mock the ETH price feed
      const priceHex = ethers.toBeHex(ethPrice).slice(2).padStart(64, '0');
      await network.provider.send("hardhat_setStorageAt", [
        await presale.ethUsdPriceFeed(),
        "0x0",
        "0x" + priceHex
      ]);

      // Calculate required ETH
      // Total USD = tokens * price per token = 1000 * 0.0025 = 2.5 USD
      // Required ETH = USD amount / ETH price = 2.5 / 2000 = 0.00125 ETH
      const requiredETH = ethers.parseEther("0.00125");
      
      await presale.connect(buyer1).purchaseTokens(tokenAmount, { value: requiredETH });

      const userInfo = await presale.userInfo(buyer1.address);
      expect(userInfo.tokenAmount).to.equal(tokenAmount);
      expect(userInfo.ethContributed).to.equal(requiredETH);
      expect(userInfo.claimed).to.be.false;
      expect(userInfo.stageId).to.equal(1);
    });

    it("Should refund excess ETH when overpaid", async function () {
      const { presale, owner, buyer1 } = await loadFixture(deployPresaleFixture);
      
      const priceUSD = ethers.parseEther("0.0025");
      await presale.connect(owner).nextStage(priceUSD);
      const tokenAmount = ethers.parseEther("1000");
      const ethPrice = ethers.parseUnits("2000", 8);
      
      const priceHex = ethers.toBeHex(ethPrice).slice(2).padStart(64, '0');
      await network.provider.send("hardhat_setStorageAt", [
        await presale.ethUsdPriceFeed(),
        "0x0",
        "0x" + priceHex
      ]);

      const requiredETH = ethers.parseEther("0.00125");
      const excess = ethers.parseEther("1");
      
      const initialBalance = await ethers.provider.getBalance(buyer1.address);
      
      const tx = await presale.connect(buyer1).purchaseTokens(tokenAmount, {
        value: requiredETH + excess
      });
      
      const receipt = await tx.wait();
      const gasUsed = receipt.gasUsed * receipt.gasPrice;
      
      const finalBalance = await ethers.provider.getBalance(buyer1.address);
      expect(initialBalance - finalBalance - gasUsed).to.equal(requiredETH);
    });
  });


  describe("Token Claiming", function () {
    it("Should prevent claiming when not enabled", async function () {
      const { presale, owner, buyer1 } = await loadFixture(deployPresaleFixture);

      const priceUSD = ethers.parseEther("0.0025");
      await presale.connect(owner).nextStage(priceUSD);
      const tokenAmount = ethers.parseEther("1000");
      const ethPrice = ethers.parseUnits("2000", 8);
      
      const priceHex = ethers.toBeHex(ethPrice).slice(2).padStart(64, '0');
      await network.provider.send("hardhat_setStorageAt", [
        await presale.ethUsdPriceFeed(),
        "0x0",
        "0x" + priceHex
      ]);

      const requiredETH = ethers.parseEther("0.00125");
      await presale.connect(buyer1).purchaseTokens(tokenAmount, { value: requiredETH });

      await expect(
        presale.connect(buyer1).claimTokens()
      ).to.be.revertedWithCustomError(presale, "PRESALE_ClaimingNotEnabled");
    });

    it("Should allow claiming purchased tokens when enabled", async function () {
      const { presale, owner, buyer1, blmnToken } = await loadFixture(deployPresaleFixture);

      const priceUSD = ethers.parseEther("0.0025");
      await presale.connect(owner).nextStage(priceUSD);
      const tokenAmount = ethers.parseEther("1000");
      const ethPrice = ethers.parseUnits("2000", 8);
      
      const priceHex = ethers.toBeHex(ethPrice).slice(2).padStart(64, '0');
      await network.provider.send("hardhat_setStorageAt", [
        await presale.ethUsdPriceFeed(),
        "0x0",
        "0x" + priceHex
      ]);

      const requiredETH = ethers.parseEther("0.00125");
      await presale.connect(buyer1).purchaseTokens(tokenAmount, { value: requiredETH });

      await presale.connect(owner).updatePresaleStatus(false, true);
      await presale.connect(buyer1).claimTokens();

      const balance = await blmnToken.balanceOf(buyer1.address);
      expect(balance).to.equal(tokenAmount);
    });
  });


  describe("Fund Management", function () {
    it("Should allow owner to withdraw ETH", async function () {
      const { presale, owner, buyer1 } = await loadFixture(deployPresaleFixture);

      // Setup purchase with known values
      const priceUSD = ethers.parseEther("0.0025");
      await presale.connect(owner).nextStage(priceUSD);
      const tokenAmount = ethers.parseEther("1000");
      const ethPrice = ethers.parseUnits("2000", 8);
      
      const priceHex = ethers.toBeHex(ethPrice).slice(2).padStart(64, '0');
      await network.provider.send("hardhat_setStorageAt", [
        await presale.ethUsdPriceFeed(),
        "0x0",
        "0x" + priceHex
      ]);

      const requiredETH = ethers.parseEther("0.00125");
      await presale.connect(buyer1).purchaseTokens(tokenAmount, { value: requiredETH });

      const initialBalance = await ethers.provider.getBalance(owner.address);
      const tx = await presale.connect(owner).withdrawETH();
      const receipt = await tx.wait();
      const gasUsed = receipt.gasUsed * receipt.gasPrice;

      const finalBalance = await ethers.provider.getBalance(owner.address);
      expect(finalBalance - initialBalance + gasUsed).to.equal(requiredETH);
    });

    it("Should allow owner to withdraw unsold tokens after presale end", async function () {
      const { presale, owner, blmnToken } = await loadFixture(deployPresaleFixture);

      // End presale
      await presale.connect(owner).updatePresaleStatus(true, false);
      
      const initialBalance = await blmnToken.balanceOf(owner.address);
      await presale.connect(owner).withdrawUnsoldTokens();
      const finalBalance = await blmnToken.balanceOf(owner.address);

      expect(finalBalance).to.be.gt(initialBalance);
    });
  });

  describe("Events", function () {
    it("Should emit TokensPurchased event with correct parameters", async function () {
      const { presale, owner, buyer1 } = await loadFixture(deployPresaleFixture);

      const priceUSD = ethers.parseEther("0.0025");
      await presale.connect(owner).nextStage(priceUSD);
      
      const tokenAmount = ethers.parseEther("1000");
      const ethPrice = ethers.parseUnits("2000", 8);
      
      const priceHex = ethers.toBeHex(ethPrice).slice(2).padStart(64, '0');
      await network.provider.send("hardhat_setStorageAt", [
        await presale.ethUsdPriceFeed(),
        "0x0",
        "0x" + priceHex
      ]);

      const requiredETH = ethers.parseEther("0.00125");
      // For event checking, calculate the USD cost
      const usdCost = ethers.parseEther("2.5"); // $2.5 for 1000 tokens at $0.0025 each

      await expect(
        presale.connect(buyer1).purchaseTokens(tokenAmount, { value: requiredETH })
      )
        .to.emit(presale, "TokensPurchased")
        .withArgs(buyer1.address, tokenAmount, requiredETH, usdCost, 1);
    });

    it("Should emit TokensClaimed event", async function () {
      const { presale, owner, buyer1 } = await loadFixture(deployPresaleFixture);

      const priceUSD = ethers.parseEther("0.0025");
      await presale.connect(owner).nextStage(priceUSD);
      
      const tokenAmount = ethers.parseEther("1000");
      const ethPrice = ethers.parseUnits("2000", 8);
      
      const priceHex = ethers.toBeHex(ethPrice).slice(2).padStart(64, '0');
      await network.provider.send("hardhat_setStorageAt", [
        await presale.ethUsdPriceFeed(),
        "0x0",
        "0x" + priceHex
      ]);

      const requiredETH = ethers.parseEther("0.00125");
      await presale.connect(buyer1).purchaseTokens(tokenAmount, { value: requiredETH });

      // Enable claiming
      await presale.connect(owner).updatePresaleStatus(false, true);

      await expect(presale.connect(buyer1).claimTokens())
        .to.emit(presale, "TokensClaimed")
        .withArgs(buyer1.address, tokenAmount);
    });

    it("Should emit PresaleStatusUpdated event", async function () {
      const { presale, owner } = await loadFixture(deployPresaleFixture);

      await expect(presale.connect(owner).updatePresaleStatus(true, true))
        .to.emit(presale, "PresaleStatusUpdated")
        .withArgs(true, true);
    });
  });

  describe("Receive Function", function () {
    it("Should revert on direct ETH transfers", async function () {
      const { presale, buyer1 } = await loadFixture(deployPresaleFixture);
      const amount = ethers.parseEther("1");

      // Using a raw transaction to trigger receive function
      const tx = {
        to: await presale.getAddress(),
        value: amount,
        data: "0x" // Empty data field to trigger receive
      };

      await expect(
        buyer1.sendTransaction(tx)
      ).to.be.revertedWithCustomError(presale, "PRESALE_InvalidPurchaseAmount");
    });
  });
});
