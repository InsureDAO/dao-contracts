const { expect } = require("chai");
const { ethers } = require("hardhat");
const { BigNumber } = require('ethers');

describe('LiquidityGauge', function() {

    const name = "InsureToken";
    const simbol = "Insure";
    const decimal = 18;

    beforeEach(async () => {
        //import
        [creator, alice, bob, charly] = await ethers.getSigners();
        const Token = await ethers.getContractFactory('InsureToken');
        const VotingEscrow = await ethers.getContractFactory('VotingEscrow');

        Insure = await Token.deploy(name, simbol, decimal);
        ve = await VotingEscrow.deploy(Insure.address, "Voting-escrowed Insure", "veInsure", 'veInsure');
    });

    describe("test_votingescrow_admin", function(){
        it("test_commit_admin_only", async()=> {
            await expect(
                ve.connect(alice).commit_transfer_ownership(alice.address)).to.revertedWith(
                "dev: admin only"
            );
        });

        it("test_apply_admin_only", async()=> {
            await expect(
                ve.connect(alice).apply_transfer_ownership()).to.revertedWith(
                "dev: admin only"
            );
        });

        it("test_commit_transfer_ownership", async()=> {
            await ve.commit_transfer_ownership(alice.address);

            expect(await ve.admin()).to.equal(creator.address);
            expect(await ve.future_admin()).to.equal(alice.address);
        });

        it("test_apply_transfer_ownership", async()=> {
            await ve.commit_transfer_ownership(alice.address);
            expect(await ve.admin()).to.equal(creator.address);
            expect(await ve.future_admin()).to.equal(alice.address);

            await ve.apply_transfer_ownership();

            expect(await ve.admin()).to.equal(alice.address);
            expect(await ve.future_admin()).to.equal(alice.address);
        });

        it("test_apply_without_commit", async()=> {
            await expect(
                ve.apply_transfer_ownership()).to.revertedWith(
                "dev: admin not set"
            );
        });
    });
});