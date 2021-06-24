const { expect } = require("chai");
const { ethers } = require("hardhat");
const { BigNumber } = require('ethers');


describe('Minter', function(){
    const YEAR = BigNumber.from(86400*365);
    const MONTH = BigNumber.from(86400*30);
    const WEEK = BigNumber.from(86400*7);
    const DAY = BigNumber.from(86400);

    const name = "InsureToken";
    const simbol = "Insure";
    const decimal = 18;

    const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

    const MAX_UINT256 = BigNumber.from('115792089237316195423570985008687907853269984665640564039457584007913129639935');
    const two_to_the_256_minus_1 = (BigNumber.from('2')).pow(BigNumber.from('256')).sub(BigNumber.from('1'));
    const ten_to_the_21 = BigNumber.from("1000000000000000000000");
    const ten_to_the_20 = BigNumber.from("100000000000000000000");
    const ten_to_the_19 = BigNumber.from("10000000000000000000");
    const ten_to_the_18 = BigNumber.from("1000000000000000000");
    const ten_to_the_17 = BigNumber.from("100000000000000000");
    const ten_to_the_9 = BigNumber.from("1000000000");

    const a = BigNumber.from("5");
    const zero = BigNumber.from("0");

    const TYPE_WEIGHTS = [ten_to_the_17.mul(a), ten_to_the_19];
    const GAUGE_WEIGHTS = [ten_to_the_19, ten_to_the_18, ten_to_the_17.mul(a)];
    const GAUGE_TYPES = [1, 1, 2];

    beforeEach(async () => {
        //import
        [creator, alice, bob, charly] = await ethers.getSigners();
        const Token = await ethers.getContractFactory('InsureToken');
        const VotingEscrow = await ethers.getContractFactory('VotingEscrow');
        const GaugeController = await ethers.getContractFactory('GaugeController');
        const Registry = await ethers.getContractFactory('TestRegistry');
        const Minter = await ethers.getContractFactory('Minter');
        const TestConverter = await ethers.getContractFactory('TestConverter');

        //deploy
        Insure = await Token.deploy(name, simbol, decimal);
        voting_escrow = await VotingEscrow.deploy(Insure.address, "Voting-escrowed Insure", "veInsure", 'veInsure');
        gauge_controller = await GaugeController.deploy(Insure.address, voting_escrow.address);
        converter = await TestConverter.deploy(Insure.address);

        registry = await Registry.deploy();
        minter = await Minter.deploy(Insure.address, gauge_controller.address, registry.address);
        
        await Insure.set_minter(minter.address);
    });

    describe("test_emergency_mint", function(){
        it("test_emergency_mint", async()=>{
            let amount = BigNumber.from("1000");

            await minter.set_converter(converter.address);
            await minter.connect(alice).emergency_mint(amount);

            expect(await Insure.balanceOf(converter.address)).to.equal(55);//55 defined at TestConverter.sol
        });

    });
});