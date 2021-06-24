const { expect } = require("chai");
const { ethers } = require("hardhat");
const { BigNumber } = require('ethers');

describe('VestingEscrow', function() {
    const YEAR = BigNumber.from(86400*365);

    const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
    const ten_to_the_21 = BigNumber.from("1000000000000000000000");
    const ten_to_the_20 = BigNumber.from("100000000000000000000");
    const ten_to_the_17 = BigNumber.from("100000000000000000");

    beforeEach(async () => {
        //import
        [creator, alice, bob, chad, dad] = await ethers.getSigners();
        const VestingEscrow = await ethers.getContractFactory('VestingEscrow');
        const TestToken = await ethers.getContractFactory('TestToken');

        //deploy TestToken and VestingEscrow. Then mint and approve VestingEscrow to Vest 10**21 tokens.
        let now = BigNumber.from((await ethers.provider.getBlock('latest')).timestamp);
        start_time = now.add(BigNumber.from('1000')).add(YEAR);
        end_time = start_time.add(BigNumber.from('100000000'));

        coin_a = await TestToken.deploy("Coin A", "USDA", 18);
        vesting = await VestingEscrow.deploy(coin_a.address, start_time, end_time, true, [alice.address, bob.address, chad.address, dad.address]);

        await coin_a._mint_for_testing(ten_to_the_21);
        await coin_a.approve(vesting.address, ten_to_the_21);
    });

    describe("test_vesting_escrow_admin", function(){
        it("test_commit_admin_only", async()=> {
            await expect(
                vesting.connect(alice).commit_transfer_ownership(alice.address)).to.revertedWith(
                "dev: admin only"
            );
        });

        it("test_apply_admin_only", async()=> {
            await expect(
                vesting.connect(alice).apply_transfer_ownership()).to.revertedWith(
                "dev: admin only"
            );
        });

        it("test_commit_transfer_ownership", async()=> {
            await vesting.commit_transfer_ownership(alice.address);

            expect(await vesting.admin()).to.equal(creator.address);
            expect(await vesting.future_admin()).to.equal(alice.address);
        });

        it("test_apply_transfer_ownership", async()=> {
            await vesting.commit_transfer_ownership(alice.address);
            await vesting.apply_transfer_ownership();

            expect(await vesting.admin()).to.equal(alice.address);
            expect(await vesting.future_admin()).to.equal(alice.address);//after first commit&apply, future_admin keep being set as is
        });

        it("test_apply_without_commit", async()=> {
            await expect(
                vesting.apply_transfer_ownership()).to.revertedWith(
                "dev: admin not set"
            );
        });

    });

    
});