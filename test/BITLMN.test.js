const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

describe("BLMN Token", function () {
    async function deployTokenFixture() {
        const [owner, presale, marketing, exchange, rewards, team, burner, user1, user2] = await ethers.getSigners();
        
        const BLMN = await ethers.getContractFactory("BLMN");
        const token = await BLMN.deploy(
            presale.address,
            marketing.address,
            exchange.address,
            rewards.address,
            team.address,
            burner.address
        );

        const totalSupply = ethers.parseEther("1000000000"); // 1 billion tokens
        const distribution = {
            presale: (totalSupply * 55n) / 100n,    // 55%
            marketing: (totalSupply * 12n) / 100n,   // 12%
            exchange: (totalSupply * 10n) / 100n,    // 10%
            rewards: (totalSupply * 18n) / 100n,     // 18%
            team: (totalSupply * 5n) / 100n          // 5%
        };

        return { 
            token, 
            owner, 
            presale, 
            marketing, 
            exchange, 
            rewards, 
            team,
            burner,
            user1, 
            user2,
            distribution,
            totalSupply 
        };
    }

    describe("Deployment", function () {
        it("Should deploy with correct name and symbol", async function () {
            const { token } = await loadFixture(deployTokenFixture);
            expect(await token.name()).to.equal("BLEM");
            expect(await token.symbol()).to.equal("BLEM");
        });

        it("Should set the right owner", async function () {
            const { token, owner } = await loadFixture(deployTokenFixture);
            expect(await token.owner()).to.equal(owner.address);
        });

        it("Should have correct initial addresses", async function () {
            const { token, presale, marketing, exchange, rewards, team, burner } = 
                await loadFixture(deployTokenFixture);
            
            expect(await token.PRESALE_ADDRESS()).to.equal(presale.address);
            expect(await token.MARKETING_ADDRESS()).to.equal(marketing.address);
            expect(await token.EXCHANGE_ADDRESS()).to.equal(exchange.address);
            expect(await token.REWARDS_ADDRESS()).to.equal(rewards.address);
            expect(await token.TEAM_ADDRESS()).to.equal(team.address);
            expect(await token.BURN_ADDRESS()).to.equal(burner.address);
        });

        it("Should fail deployment with zero addresses", async function () {
            const BLMN = await ethers.getContractFactory("BLMN");
            await expect(BLMN.deploy(
                ethers.ZeroAddress,
                ethers.ZeroAddress,
                ethers.ZeroAddress,
                ethers.ZeroAddress,
                ethers.ZeroAddress,
                ethers.ZeroAddress
            )).to.be.revertedWithCustomError(BLMN, "BLMN_ZeroAddress");
        });

        it("Should distribute tokens correctly", async function () {
            const { token, presale, marketing, exchange, rewards, team, distribution } = 
                await loadFixture(deployTokenFixture);

            expect(await token.balanceOf(presale.address)).to.equal(distribution.presale);
            expect(await token.balanceOf(marketing.address)).to.equal(distribution.marketing);
            expect(await token.balanceOf(exchange.address)).to.equal(distribution.exchange);
            expect(await token.balanceOf(rewards.address)).to.equal(distribution.rewards);
            expect(await token.balanceOf(team.address)).to.equal(distribution.team);
        });

        it("Should have correct total supply", async function () {
            const { token, totalSupply } = await loadFixture(deployTokenFixture);
            expect(await token.totalSupply()).to.equal(totalSupply);
        });
    });

    describe("Transfers", function () {
        it("Should allow transfers", async function () {
            const { token, presale, user1 } = await loadFixture(deployTokenFixture);
            const amount = ethers.parseEther("1000");
            await token.connect(presale).transfer(user1.address, amount);
            expect(await token.balanceOf(user1.address)).to.equal(amount);
        });

        it("Should handle multiple transfers correctly", async function () {
            const { token, presale, user1, user2 } = await loadFixture(deployTokenFixture);
            const amount = ethers.parseEther("1000");
            await token.connect(presale).transfer(user1.address, amount);
            await token.connect(user1).transfer(user2.address, amount / 2n);
            expect(await token.balanceOf(user1.address)).to.equal(amount / 2n);
            expect(await token.balanceOf(user2.address)).to.equal(amount / 2n);
        });

        it("Should prevent transfers exceeding balance", async function () {
            const { token, user1, user2 } = await loadFixture(deployTokenFixture);
            const excessAmount = ethers.parseEther("1000000000000"); // More than total supply
            await expect(token.connect(user1).transfer(user2.address, excessAmount))
                .to.be.reverted;
        });
    });

    describe("Burning", function () {
        it("Should allow token burning", async function () {
            const { token, presale } = await loadFixture(deployTokenFixture);
            const burnAmount = ethers.parseEther("1000");
            await expect(token.connect(presale).burn(burnAmount))
                .to.changeTokenBalance(token, presale, -burnAmount);
        });

        it("Should update total supply after burning", async function () {
            const { token, presale, totalSupply } = await loadFixture(deployTokenFixture);
            const burnAmount = ethers.parseEther("1000");
            await token.connect(presale).burn(burnAmount);
            expect(await token.totalSupply()).to.equal(totalSupply - burnAmount);
        });
    });
});
