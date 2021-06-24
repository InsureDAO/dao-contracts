const { expect } = require("chai");
const { ethers } = require("hardhat");
const { BigNumber } = require('ethers');

describe('VestingEscrowFactory', function() {
    beforeEach(async () => {
        //import
        [creator, alice, bob, charly] = await ethers.getSigners();
        const VestingEscrowSimple = await ethers.getContractFactory('VestingEscrowSimple');
        const VestingEscrowFactory = await ethers.getContractFactory('VestingEscrowFactory');

        //deploy
        vesting_target = await VestingEscrowSimple.deploy();
        vesting_factory = await VestingEscrowFactory.deploy(vesting_target.address, creator.address);
    });

    describe("test_admin_factory", function(){
        it("test_commit_admin_only", async()=> {
            await expect(
                vesting_factory.connect(alice).commit_transfer_ownership(alice.address)).to.revertedWith(
                "dev: admin only"
            );
        });

        it("test_apply_admin_only", async()=> {
            await expect(
                vesting_factory.connect(alice).apply_transfer_ownership()).to.revertedWith(
                "dev: admin only"
            );
        });

        it("test_commit_transfer_ownership", async()=> {
            await vesting_factory.commit_transfer_ownership(alice.address);

            expect(await vesting_factory.admin()).to.equal(creator.address);
            expect(await vesting_factory.future_admin()).to.equal(alice.address);
        });

        it("test_apply_transfer_ownership", async()=> {
            await vesting_factory.commit_transfer_ownership(alice.address);
            await vesting_factory.apply_transfer_ownership();
            
            expect(await vesting_factory.admin()).to.equal(alice.address);
            expect(await vesting_factory.future_admin()).to.equal(alice.address);
        });

        it("test_apply_without_commit", async()=> {
            await expect(
                vesting_factory.apply_transfer_ownership()).to.revertedWith(
                "dev: admin not set"
            );
            
            expect(await vesting_factory.admin()).to.equal(creator.address);
            expect(await vesting_factory.future_admin()).to.not.equal(creator.address);
            expect(await vesting_factory.future_admin()).to.not.equal(alice.address);
        });


    });

    
});