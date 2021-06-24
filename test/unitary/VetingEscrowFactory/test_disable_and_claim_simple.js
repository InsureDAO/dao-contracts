const { expect } = require("chai");
const { ethers } = require("hardhat");
const { BigNumber } = require('ethers');

describe('VestingEscrowFactory', function() {
    const YEAR = BigNumber.from(86400*365);
    const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
    const ten_to_the_21 = BigNumber.from("1000000000000000000000");
    const ten_to_the_20 = BigNumber.from("100000000000000000000");
    const ten_to_the_18 = BigNumber.from("1000000000000000000");
    const ten_to_the_8 = BigNumber.from("100000000");
    const zero = BigNumber.from("0");

    beforeEach(async () => {
        //import
        [creator, alice, bob, charly] = await ethers.getSigners();
        const TestToken = await ethers.getContractFactory('TestToken');
        const VestingEscrowSimple = await ethers.getContractFactory('VestingEscrowSimple');
        const VestingEscrowFactory = await ethers.getContractFactory('VestingEscrowFactory');

        //config
        let now = BigNumber.from((await ethers.provider.getBlock('latest')).timestamp);
        start_time = now.add(BigNumber.from('1000')).add(YEAR);
        end_time = start_time.add(ten_to_the_8);

        //deploy
        vesting_target = await VestingEscrowSimple.deploy();
        vesting_factory = await VestingEscrowFactory.deploy(vesting_target.address, creator.address);
        coin_a = await TestToken.deploy("Coin A", "USDA", 18);

        //setup
        await coin_a._mint_for_testing(ten_to_the_21);
        await coin_a.transfer(vesting_factory.address, ten_to_the_21);
        
        await vesting_factory.deploy_vesting_contract(coin_a.address, alice.address, ten_to_the_20, true, ten_to_the_8, start_time);
        const vesting_simple_address = await vesting_factory.latest_deployed_address();
        vesting_simple = await VestingEscrowSimple.attach(vesting_simple_address);
    });

    describe("test_disable_and_claim_simple", function(){
        it("test_disable_after_end_time", async()=> {
           await ethers.provider.send("evm_setNextBlockTimestamp", [end_time.toNumber()]);

           await vesting_simple.toggle_disable(alice.address);
           await vesting_simple.connect(alice).claim(alice.address);

           expect(await coin_a.balanceOf(alice.address)).to.equal(ten_to_the_20);
        });

        it("test_disable_before_start_time", async()=> {
            await vesting_simple.toggle_disable(alice.address);
            await ethers.provider.send("evm_setNextBlockTimestamp", [end_time.toNumber()]);
            await vesting_simple.connect(alice).claim(alice.address);
 
            expect(await coin_a.balanceOf(alice.address)).to.equal(zero);
        });

        it("test_disable_before_start_time_and_reenable", async()=> {
            await vesting_simple.toggle_disable(alice.address);
            await ethers.provider.send("evm_setNextBlockTimestamp", [end_time.toNumber()]);
            await vesting_simple.toggle_disable(alice.address);
            await vesting_simple.connect(alice).claim(alice.address);
 
            expect(await coin_a.balanceOf(alice.address)).to.equal(ten_to_the_20);
        });

        it("test_disable_partially_unvested", async()=> {
            await ethers.provider.send("evm_setNextBlockTimestamp", [start_time.add(BigNumber.from('31337')).toNumber()]);

            await vesting_simple.toggle_disable(alice.address);
            let timestamp = BigNumber.from((await ethers.provider.getBlock('latest')).timestamp);

            await ethers.provider.send("evm_setNextBlockTimestamp", [end_time.toNumber()]);

            await vesting_simple.connect(alice).claim(alice.address);
            let expected_amount = ten_to_the_20.mul(timestamp.sub(start_time)).div(end_time.sub(start_time));

            expect(await coin_a.balanceOf(alice.address)).to.equal(expected_amount);
        });

        it("test_disable_multiple_partial", async()=> {
            await ethers.provider.send("evm_setNextBlockTimestamp", [start_time.add(BigNumber.from('31337')).toNumber()]);
            await vesting_simple.toggle_disable(alice.address);//disable

            await ethers.provider.send("evm_increaseTime", [31337]);

            await vesting_simple.connect(alice).claim(alice.address);
            await vesting_simple.toggle_disable(alice.address);//enable
            await vesting_simple.toggle_disable(alice.address);//diable

            let timestamp = BigNumber.from((await ethers.provider.getBlock('latest')).timestamp);

            await ethers.provider.send("evm_setNextBlockTimestamp", [end_time.toNumber()]);
            await vesting_simple.connect(alice).claim(alice.address);

            let expected_amount = ten_to_the_20.mul(timestamp.sub(start_time)).div(end_time.sub(start_time));
            expect(await coin_a.balanceOf(alice.address)).to.equal(expected_amount);
        });

    });
});