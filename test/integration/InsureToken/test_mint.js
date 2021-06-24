const { expect } = require("chai");
const { ethers } = require("hardhat");
const { BigNumber } = require('ethers');

describe('InsureToken', function() {
    const name = "InsureToken";
    const simbol = "Insure";
    const decimal = 18;

    const INITIAL_SUPPLY = BigNumber.from('1303030303000000000000000000');
    const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

    const DAY = BigNumber.from(86400);
    const WEEK = BigNumber.from(86400*7);
    const YEAR = BigNumber.from(86400*365);

    function ramdom_duration(min, max){
        let rdm = Math.floor(Math.random() * (max - min) + min);

        console.log("duration: "+ rdm);
        return rdm;
    }

    async function test_mint(){
        //import
        [creator, alice, bob] = await ethers.getSigners();
        const Token = await ethers.getContractFactory('InsureToken');
        Insure = await Token.deploy(name, simbol, decimal);

        //* from: initial_setup
        await ethers.provider.send("evm_increaseTime", [DAY.toNumber()]);
        await Insure.update_mining_parameters(); //mining_epoch -1 => 0

        expect(await Insure.mining_epoch()).to.equal("0");

        await Insure.set_minter(creator.address);

        let duration = ramdom_duration(86400, 31536000);

        let creation_time = await Insure.start_epoch_time();
        let initial_supply = await Insure.totalSupply();
        let rate = await Insure.rate();

        let now = (await ethers.provider.getBlock('latest')).timestamp;
        await ethers.provider.send("evm_setNextBlockTimestamp", [now + duration]);

        let amount = (BigNumber.from(now + duration).sub(creation_time)).mul(rate);
        await Insure.mint(alice.address, amount);

        expect(await Insure.balanceOf(alice.address)).to.equal(amount);
        expect(await Insure.totalSupply()).to.equal(initial_supply.add(amount));
    }

    async function test_overmint(){
        //import
        [creator, alice, bob] = await ethers.getSigners();
        const Token = await ethers.getContractFactory('InsureToken');
        Insure = await Token.deploy(name, simbol, decimal);

        //* from: initial_setup
        await ethers.provider.send("evm_increaseTime", [DAY.toNumber()]);
        await Insure.update_mining_parameters(); //mining_epoch -1 => 0

        expect(await Insure.mining_epoch()).to.equal("0");

        let duration = ramdom_duration(86400, 31536000);

        await Insure.set_minter(creator.address);
        let creation_time = await Insure.start_epoch_time();
        let rate = await Insure.rate();

        let now = (await ethers.provider.getBlock('latest')).timestamp;
        await ethers.provider.send("evm_setNextBlockTimestamp", [now + duration]);
        
        let amount = rate.mul(BigNumber.from(now + duration).sub(creation_time)).add(BigNumber.from('2'));

        await expect(
            Insure.mint(alice.address, amount)).to.revertedWith(
            "dev: exceeds allowable mint amount"
        );
    }

    async function test_mint_multiple(){
        //---------generate random# -------------//
        let min = 31536000*0.33; //DAY
        let max = 31536000*0.9; //YEAR
        let durations = [];

        for(let i=0; i<5; i++){
            let duration = ramdom_duration(min, max);
            durations.push(duration);
        }
        //---------------------------------------//

        //import
        [creator, alice, bob] = await ethers.getSigners();
        const Token = await ethers.getContractFactory('InsureToken');
        Insure = await Token.deploy(name, simbol, decimal);

        //* from: initial_setup
        await ethers.provider.send("evm_increaseTime", [DAY.toNumber()]);
        await Insure.update_mining_parameters(); //mining_epoch -1 => 0

        expect(await Insure.mining_epoch()).to.equal("0");


        await Insure.set_minter(creator.address);
        let total_supply = await Insure.totalSupply();
        let balance = BigNumber.from('0');
        let epoch_start = await Insure.start_epoch_time();

        for(let i=0; i<5; i++){
            let now = (await ethers.provider.getBlock('latest')).timestamp;
            let new_timestamp = now + durations[i];
            await ethers.provider.send("evm_setNextBlockTimestamp", [new_timestamp]);

            if((BigNumber.from(new_timestamp)).sub(epoch_start).gt(YEAR)){
                await Insure.update_mining_parameters();
                epoch_start = await Insure.start_epoch_time();
            }else{
                await ethers.provider.send("evm_mine");
            }

            let amount = (await Insure.available_supply()).sub(total_supply);
            await Insure.mint(alice.address, amount);

            balance = balance.add(amount);
            total_supply = total_supply.add(amount);

            expect(await Insure.balanceOf(alice.address)).to.equal(balance);
            expect(await Insure.totalSupply()).to.equal(total_supply);
        }
    }


    describe("test_mint", function(){

        it('test_mint', async()=>{
            for(i=0; i<10; i++){
                await test_mint();
            }
        });

        it('test_overmint', async()=>{
            for(i=0; i<10; i++){
                await test_overmint();
            }
        });

        it("test_mint_multiple", async()=>{
            for(i=0; i<10; i++){
                await test_mint_multiple();
            }
        });

    });
});