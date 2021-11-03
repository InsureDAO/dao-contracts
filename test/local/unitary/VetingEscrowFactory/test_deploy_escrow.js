const { expect } = require("chai");
const { ethers } = require("hardhat");
const { BigNumber } = require('ethers');

describe('VestingEscrowFactory', function() {
    const YEAR = BigNumber.from(86400*365);
    const DAY = BigNumber.from(86400);

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
        VestingEscrowSimple = await ethers.getContractFactory('VestingEscrowSimple'); //want to make this public
        const VestingEscrowFactory = await ethers.getContractFactory('VestingEscrowFactory');
        
        vesting_target = await VestingEscrowSimple.deploy();
        vesting_factory = await VestingEscrowFactory.deploy(vesting_target.address, creator.address);
        coin_a = await TestToken.deploy("Coin A", "USDA", 18);

        await coin_a._mint_for_testing(ten_to_the_21);
        await coin_a.transfer(vesting_factory.address, ten_to_the_21);
    });

    describe("test_deploy_escrow", function(){
        it("test_admin_only", async()=> {
            let now = BigNumber.from((await ethers.provider.getBlock('latest')).timestamp);
            await expect(
                vesting_factory.connect(alice).deploy_vesting_contract(
                    coin_a.address, alice.address, ten_to_the_18, true, YEAR, now
                )).to.revertedWith(
                "dev: admin only"
            );
        });

        it("test_approve_fail", async()=> {
            let now = BigNumber.from((await ethers.provider.getBlock('latest')).timestamp);
            await expect(
                vesting_factory.deploy_vesting_contract(ZERO_ADDRESS, alice.address, ten_to_the_18, true, YEAR, now.add(DAY))).to.revertedWith(
                "dev: zero address"
            );
        });

        it("test_start_too_soon", async()=> {
            let now = BigNumber.from((await ethers.provider.getBlock('latest')).timestamp);
            await expect(
                vesting_factory.deploy_vesting_contract(coin_a.address, alice.address, ten_to_the_18, true, YEAR, now.sub(BigNumber.from('1')))).to.revertedWith(
                "dev: start time too soon"
            );
        });

        it("test_duration_too_short", async()=> {
            let now = BigNumber.from((await ethers.provider.getBlock('latest')).timestamp);
            await expect(
                vesting_factory.deploy_vesting_contract(coin_a.address, alice.address, ten_to_the_18, true, YEAR.sub(BigNumber.from('1')), now.add(DAY))).to.revertedWith(
                "dev: duration too short"
            );
        });

        it("test_target_is_set", async()=> {
            expect(await vesting_factory.target()).to.equal(vesting_target.address);
        });

        it("test_deploys", async()=> {
            let now = BigNumber.from((await ethers.provider.getBlock('latest')).timestamp);

            expect(await vesting_factory.latest_deployed_address()).to.equal(ZERO_ADDRESS);
            await vesting_factory.deploy_vesting_contract(coin_a.address, alice.address, ten_to_the_18, true, YEAR, now.add(DAY));
            expect(await vesting_factory.latest_deployed_address()).to.not.equal(ZERO_ADDRESS);
        });

        it("test_start_and_duration", async()=> {
            let now = BigNumber.from((await ethers.provider.getBlock('latest')).timestamp);
            const start_time = now.add(BigNumber.from('100'));

            await vesting_factory.deploy_vesting_contract(coin_a.address, alice.address, ten_to_the_18, true, YEAR, start_time);
            let addr = await vesting_factory.latest_deployed_address();

            
            escrow = await VestingEscrowSimple.attach(addr);

            expect(await escrow.start_time()).to.equal(start_time);
            expect(await escrow.end_time()).to.equal(start_time.add(YEAR));
        });

        it("test_token_xfer", async()=> {
            let now = BigNumber.from((await ethers.provider.getBlock('latest')).timestamp);
            const start_time = now.add(BigNumber.from('100'));

            await vesting_factory.deploy_vesting_contract(coin_a.address, alice.address, ten_to_the_20, true, ten_to_the_8, start_time);
            const vesting_simple_address = await vesting_factory.latest_deployed_address();
            vesting_simple = await VestingEscrowSimple.attach(vesting_simple_address);

            expect(await coin_a.balanceOf(vesting_simple.address)).to.equal(ten_to_the_20);
        });

        it("test_token_approval", async()=> {
            let now = BigNumber.from((await ethers.provider.getBlock('latest')).timestamp);
            const start_time = now.add(BigNumber.from('100'));

            await vesting_factory.deploy_vesting_contract(coin_a.address, alice.address, ten_to_the_20, true, ten_to_the_8, start_time);
            const vesting_simple_address = await vesting_factory.latest_deployed_address();
            vesting_simple = await VestingEscrowSimple.attach(vesting_simple_address);

            expect(await coin_a.allowance(vesting_simple.address, vesting_factory.address)).to.equal(zero);

        });

        it("test_init_vars", async()=> {
            let now = BigNumber.from((await ethers.provider.getBlock('latest')).timestamp);
            const start_time = now.add(BigNumber.from('100'));
            const end_time = start_time.add(ten_to_the_8);

            await vesting_factory.deploy_vesting_contract(coin_a.address, alice.address, ten_to_the_20, true, ten_to_the_8, start_time);
            const vesting_simple_address = await vesting_factory.latest_deployed_address();
            vesting_simple = await VestingEscrowSimple.attach(vesting_simple_address);

            expect(await vesting_simple.token()).to.equal(coin_a.address);
            expect(await vesting_simple.admin()).to.equal(creator.address);
            expect(await vesting_simple.start_time()).to.equal(start_time);
            expect(await vesting_simple.end_time()).to.equal(end_time);
            expect(await vesting_simple.can_disable()).to.equal(true);
            expect(await vesting_simple.initial_locked(alice.address)).to.equal(ten_to_the_20);
        });

        it("test_cannot_call_init_factory_target", async()=> {
            await expect(
                vesting_target.initialize(
                    creator.address,
                    coin_a.address,
                    alice.address,
                    ten_to_the_20,
                    start_time,
                    end_time,
                    true
                )).to.revertedWith(
                "dev: can only initialize once"
            );
        });

        it("test_cannot_call_init", async()=> {
            let now = BigNumber.from((await ethers.provider.getBlock('latest')).timestamp);
            const start_time = now.add(BigNumber.from('100'));
            const end_time = start_time.add(ten_to_the_8);

            await vesting_factory.deploy_vesting_contract(coin_a.address, alice.address, ten_to_the_20, true, ten_to_the_8, start_time);
            const vesting_simple_address = await vesting_factory.latest_deployed_address();
            vesting_simple = await VestingEscrowSimple.attach(vesting_simple_address);

            await expect(
                vesting_simple.initialize(
                    creator.address,
                    coin_a.address,
                    alice.address,
                    ten_to_the_20,
                    start_time,
                    end_time,
                    true
                )).to.revertedWith(
                "dev: can only initialize once"
            );
        });

    });
});