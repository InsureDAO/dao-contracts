const { expect } = require("chai");
const { ethers } = require("hardhat");
const { BigNumber } = require('ethers');

describe('VestingEscrowFactory', function() {
    const YEAR = BigNumber.from(86400*365);

    const ten_to_the_21 = BigNumber.from("1000000000000000000000");
    const ten_to_the_20 = BigNumber.from("100000000000000000000");
    const ten_to_the_8 = BigNumber.from("100000000");
    beforeEach(async () => {
        //import
        [creator, alice, bob, charly] = await ethers.getSigners();
        const TestToken = await ethers.getContractFactory('TestToken');
        const VestingEscrowSimple = await ethers.getContractFactory('VestingEscrowSimple');
        const VestingEscrowFactory = await ethers.getContractFactory('VestingEscrowFactory');

        let now = BigNumber.from((await ethers.provider.getBlock('latest')).timestamp);
        start_time = now.add(BigNumber.from('1000')).add(YEAR);

        vesting_target = await VestingEscrowSimple.deploy();
        vesting_factory = await VestingEscrowFactory.deploy(vesting_target.address, creator.address);
        coin_a = await TestToken.deploy("Coin A", "USDA", 18);

        await coin_a._mint_for_testing(ten_to_the_21);
        await coin_a.transfer(vesting_factory.address, ten_to_the_21);
        
        await vesting_factory.deploy_vesting_contract(coin_a.address, alice.address, ten_to_the_20, true, ten_to_the_8, start_time);
        const vesting_simple_address = await vesting_factory.latest_deployed_address();
        vesting_simple = await VestingEscrowSimple.attach(vesting_simple_address);
    });

    describe("test_admin_simple", function(){
        it("test_commit_admin_only", async()=> {
            await expect(vesting_simple.connect(alice).commit_transfer_ownership(alice.address)).to.revertedWith("dev: admin only");
        });

        it("test_accept_admin_only", async()=> {
            await expect(vesting_simple.connect(alice).accept_transfer_ownership()).to.revertedWith("dev: future_admin only");
        });

        it("test_commit_transfer_ownership", async()=> {
            await vesting_simple.commit_transfer_ownership(alice.address);

            expect(await vesting_simple.admin()).to.equal(creator.address);
            expect(await vesting_simple.future_admin()).to.equal(alice.address);
        });

        it("test_accept_transfer_ownership", async()=> {
            await vesting_simple.commit_transfer_ownership(alice.address);
            await vesting_simple.connect(alice).accept_transfer_ownership();

            expect(await vesting_simple.admin()).to.equal(alice.address);
            expect(await vesting_simple.future_admin()).to.equal(alice.address);
        });

    });

    
});