const { expect } = require("chai");
const { ethers } = require("hardhat");
const bn = require('bignumber.js');
const { BigNumber } = require('ethers');
const { formatEther, parseEther } = ethers.utils;

bn.config({ EXPONENTIAL_AT: 999999, DECIMAL_PLACES: 40 })

const QuoterArtifact = require('@uniswap/v3-periphery/artifacts/contracts/lens/Quoter.sol/Quoter.json');
const QuoterAddress = '0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6';

const FactoryArtifact = require('@uniswap/v3-core/artifacts/contracts/UniswapV3Factory.sol/UniswapV3Factory.json');
const FactoryAddress = '0x1F98431c8aD98523631AE4a59f267346ea31F984';

const INonfungiblePositionManager = require('@uniswap/v3-periphery/artifacts/contracts/NonfungiblePositionManager.sol/NonfungiblePositionManager.json');
const IPoolInitializer = require('@uniswap/v3-periphery/artifacts/contracts/interfaces/IPoolInitializer.sol/IPoolInitializer.json');
const nonFungiblePositionManagerAddress = "0xC36442b4a4522E871399CD717aBDD847Ab11FE88";


async function encodePriceSqrt(reserve1, reserve0) {
    return BigNumber.from(
      new bn(reserve1.toString())
        .div(reserve0.toString())
        .sqrt()
        .multipliedBy(new bn(2).pow(96))
        .integerValue(3)
        .toString()
    )
}

const FeeAmount = {
    LOW: 500,
    MEDIUM: 3000,
    HIGH: 10000,
}

const TICK_SPACINGS = {
    [FeeAmount.LOW]: 10,
    [FeeAmount.MEDIUM]: 60,
    [FeeAmount.HIGH]: 200,
  }

const getMinTick = (tickSpacing) => Math.ceil(-887272 / tickSpacing) * tickSpacing;
const getMaxTick = (tickSpacing) => Math.floor(887272 / tickSpacing) * tickSpacing;


/***
 * insure deploy
 * converter deploy
 * 
 * swap ETH to USDC
 * put INSURE/ETH liquidity on UniswapV3
 * swap_exact_to_insure() USDC => INSURE
 * 
 */

describe('TEST', () => {
    const name = "Fee Token";
    const simbol = "FT";
    const decimal = 18;
    const rpt_decimal = 0;

    const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
    const FEE = BigNumber.from("1000000")
  
    beforeEach(async () => {
        [creator, alice, bob, chad, dad] = await ethers.getSigners();
        addresses = [creator.address, alice.address, bob.address, chad.address, dad.address]
        const Token = await ethers.getContractFactory('TestToken');
        const Converter = await ethers.getContractFactory('ConverterV1_2');

        tokenA = await Token.deploy(name, simbol, decimal);
        tokenB = await Token.deploy(name, simbol, decimal);

        if (tokenA.address.toLowerCase() > tokenB.address.toLowerCase()) {
            [tokenA, tokenB] = [tokenB, tokenA];
        }

        converter = await Converter.deploy(tokenA.address);

        quoter = await ethers.getContractAt(QuoterArtifact.abi, QuoterAddress);
        factory = await ethers.getContractAt(FactoryArtifact.abi, FactoryAddress);

        //1. create a pool
        const amount = 1000;
        await tokenA._mint_for_testing(1000);
        await tokenB._mint_for_testing(1000);

        const poolInitializer = await ethers.getContractAt(IPoolInitializer.abi, nonFungiblePositionManagerAddress);
        const tx = await poolInitializer.createAndInitializePoolIfNecessary(
            tokenA.address,
            tokenB.address,
            FeeAmount.MEDIUM,
            encodePriceSqrt(amount, amount)
        );
        const receipt = await tx.wait();
        const poolAddress = receipt.events[0].data.slice(-40);

        const nft = await ethers.getContractAt(INonfungiblePositionManager.abi, nonFungiblePositionManagerAddress);

        
        // 2. provide liquidity
        const deposit = amount;

        await (await tokenA.approve(nonFungiblePositionManagerAddress, deposit)).wait();
        await (await tokenB.approve(nonFungiblePositionManagerAddress, deposit)).wait();

        const mintParams = {
            token0: tokenA.address,
            token1: tokenB.address,
            fee: FeeAmount.MEDIUM,
            tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
            tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
            recipient: creator.address,
            amount0Desired: deposit,
            amount1Desired: deposit,
            amount0Min: 0,
            amount1Min: 0,
            deadline: 19238129083 //2579year
        }

        const mintTx = await nft.mint(mintParams);
        const mintReceipt = await mintTx.wait();
        const evt = mintReceipt.events.find(x => x.event === "Transfer");
        const {tokenId} = evt.args;

        return { poolAddress, tokenId }
    });

    describe("Condition", function () {
        it("contract should be deployed", async () => {
            expect(await tokenA.address).to.exist;
            expect(await tokenB.address).to.exist;
            expect(await converter.address).to.exist;
            expect(await quoter.address).to.exist;
            expect(await factory.address).to.exist;
        }); 
    });

    describe("swap_exact_to_insure()", function () {
        it("", async () => {
        }); 
    });
});