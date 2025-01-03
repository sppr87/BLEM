const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture, time } = require("@nomicfoundation/hardhat-network-helpers");

describe("BITLMN Presale", function () {
  async function deployPresaleFixture() {
    const [owner, token, buyer1, buyer2, buyer3] = await ethers.getSigners();

    // Deploy mock price feed
    const MockV3Aggregator = await ethers.getContractFactory("MockV3Aggregator");
    const mockPriceFeed = await MockV3Aggregator.deploy(8, ethers.parseUnits("2000", 8)); // $2000 USD/ETH

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
      expect(await presale.presaleEnded()).to.be.false;
      expect(await presale.presaleEndTime()).to.equal(0);
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
      
      await presale.connect(owner).nextStage(ethers.parseEther("0.0025"));
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
    it("Should prevent claiming before presale ends", async function () {
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
      ).to.be.revertedWithCustomError(presale, "PRESALE_NotActive");
    });

    it("Should prevent claiming before delay period ends", async function () {
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

      await presale.connect(owner).endPresale();
      
      await expect(
        presale.connect(buyer1).claimTokens()
      ).to.be.revertedWithCustomError(presale, "PRESALE_ClaimingNotEnabled");
    });

    it("Should allow claiming after delay period", async function () {
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

      await presale.connect(owner).endPresale();
      
      // Fast forward 24 hours
      await time.increase(24 * 60 * 60);

      await presale.connect(buyer1).claimTokens();

      const balance = await blmnToken.balanceOf(buyer1.address);
      expect(balance).to.equal(tokenAmount);
    });

    it("Should prevent double claiming", async function () {
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

      await presale.connect(owner).endPresale();
      await time.increase(24 * 60 * 60);
      await presale.connect(buyer1).claimTokens();

      await expect(
        presale.connect(buyer1).claimTokens()
      ).to.be.revertedWithCustomError(presale, "PRESALE_AlreadyClaimed");
    });
  });

  describe("Presale End", function () {
    it("Should set correct end time when ending presale", async function () {
      const { presale, owner } = await loadFixture(deployPresaleFixture);
      
      const tx = await presale.connect(owner).endPresale();
      const receipt = await tx.wait();
      const block = await ethers.provider.getBlock(receipt.blockNumber);
      
      expect(await presale.presaleEndTime()).to.equal(block.timestamp);
      expect(await presale.presaleEnded()).to.be.true;
    });

    it("Should emit PresaleEnded event with correct timestamp", async function () {
      const { presale, owner } = await loadFixture(deployPresaleFixture);
      
      const tx = await presale.connect(owner).endPresale();
      const receipt = await tx.wait();
      const block = await ethers.provider.getBlock(receipt.blockNumber);
      
      await expect(tx)
        .to.emit(presale, "PresaleEnded")
        .withArgs(block.timestamp);
    });
  });

  describe("Fund Management", function () {
  

    it("Should allow owner to withdraw unsold tokens after presale end", async function () {
      const { presale, owner, blmnToken } = await loadFixture(deployPresaleFixture);

      await presale.connect(owner).endPresale();
      
      const initialBalance = await blmnToken.balanceOf(owner.address);
      await presale.connect(owner).withdrawUnsoldTokens();
      const finalBalance = await blmnToken.balanceOf(owner.address);

      expect(finalBalance).to.be.gt(initialBalance);
    });
  });

  describe("View Functions", function () {
    it("Should return correct presale status", async function () {
      const { presale, owner } = await loadFixture(deployPresaleFixture);
      
      await presale.connect(owner).nextStage(ethers.parseEther("0.0025"));
      
      let status = await presale.getPresaleStatus();
      expect(status.isActive).to.be.true;
      expect(status.isClaimingEnabled).to.be.false;
      expect(status.isPresaleEnded).to.be.false;
      
      await presale.connect(owner).endPresale();
      
      status = await presale.getPresaleStatus();
      expect(status.isActive).to.be.false;
      expect(status.isClaimingEnabled).to.be.false;
      expect(status.isPresaleEnded).to.be.true;
      
      await time.increase(24 * 60 * 60);
      
      status = await presale.getPresaleStatus();
      expect(status.isActive).to.be.false;
      expect(status.isClaimingEnabled).to.be.true;
      expect(status.isPresaleEnded).to.be.true;
    });
  });
});
