const { expect } = require("chai");
const { ethers } = require("hardhat");
const { BigNumber } = require('ethers');

describe('VestingEscrowFactory', function() {
    const YEAR = BigNumber.from(86400*365);
    const ten_to_the_21 = BigNumber.from("1000000000000000000000");
    const ten_to_the_20 = BigNumber.from("100000000000000000000");
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

    describe("test_claim_full", function(){
        it("test_claim_for_self", async()=> {
           await ethers.provider.send("evm_setNextBlockTimestamp", [end_time.toNumber()]);
           await vesting_simple.connect(alice).claim(alice.address);

           expect(await coin_a.balanceOf(alice.address)).to.equal(ten_to_the_20);
        });

        it("test_claim_for_another", async()=> {
            await ethers.provider.send("evm_setNextBlockTimestamp", [end_time.toNumber()]);
            await vesting_simple.connect(bob).claim(alice.address);
 
            expect(await coin_a.balanceOf(alice.address)).to.equal(ten_to_the_20);
        });

        it("test_claim_before_start", async()=> {
            await ethers.provider.send("evm_setNextBlockTimestamp", [start_time.sub(BigNumber.from('5')).toNumber()]);
            await vesting_simple.connect(alice).claim(alice.address);
 
            expect(await coin_a.balanceOf(alice.address)).to.equal(zero);
        });

        it("test_claim_partial", async()=> {
            await ethers.provider.send("evm_setNextBlockTimestamp", [start_time.add(BigNumber.from('31337')).toNumber()]);
            await vesting_simple.connect(alice).claim(alice.address);

            let now = BigNumber.from((await ethers.provider.getBlock('latest')).timestamp);
            let expected_amount = ten_to_the_20.mul(now.sub(start_time)).div(end_time.sub(start_time));

            expect(await coin_a.balanceOf(alice.address)).to.equal(expected_amount);
            expect(await vesting_simple.total_claimed(alice.address)).to.equal(expected_amount);
        });

        it("test_claim_multiple", async()=> {
            await ethers.provider.send("evm_setNextBlockTimestamp", [start_time.sub(BigNumber.from('1000')).toNumber()]);
            await ethers.provider.send("evm_mine");
            let balance = BigNumber.from('0');

            for(let i=0; i<11; i++){
                await ethers.provider.send("evm_increaseTime", [end_time.sub(start_time).div(BigNumber.from('10')).toNumber()]);
                await vesting_simple.connect(alice).claim(alice.address);
                let new_balance = await coin_a.balanceOf(alice.address);


                expect(new_balance.gte(balance)).to.equal(true);
                expect(await vesting_simple.total_claimed(alice.address)).to.equal(new_balance);
                balance = new_balance;
            }

            expect(await coin_a.balanceOf(alice.address)).to.equal(ten_to_the_20);
            expect(await vesting_simple.total_claimed(alice.address)).to.equal(ten_to_the_20);
        });

         

    });
});