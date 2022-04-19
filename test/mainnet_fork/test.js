const { expect } = require("chai");
const { ethers } = require("hardhat");
const bn = require("bignumber.js");
const { BigNumber } = require("ethers");
const { formatEther, parseEther } = ethers.utils;

bn.config({ EXPONENTIAL_AT: 999999, DECIMAL_PLACES: 40 });

async function encodePriceSqrt(reserve1, reserve0) {
  return BigNumber.from(
    new bn(reserve1.toString())
      .div(reserve0.toString())
      .sqrt()
      .multipliedBy(new bn(2).pow(96))
      .integerValue(3)
      .toString()
  );
}

const FeeAmount = {
  LOW: 500,
  MEDIUM: 3000,
  HIGH: 10000,
};

const TICK_SPACINGS = {
  [FeeAmount.LOW]: 10,
  [FeeAmount.MEDIUM]: 60,
  [FeeAmount.HIGH]: 200,
};

const getMinTick = (tickSpacing) => Math.ceil(-887272 / tickSpacing) * tickSpacing;
const getMaxTick = (tickSpacing) => Math.floor(887272 / tickSpacing) * tickSpacing;

describe("Converter", () => {
  const name = "Fee Token";
  const symbol = "FT";
  const decimal = 18;
  const rpt_decimal = 0;

  const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
  const FEE = BigNumber.from("1000000");

  const FactoryArtifact = require("@uniswap/v3-core/artifacts/contracts/UniswapV3Factory.sol/UniswapV3Factory.json");
  const FactoryAddress = "0x1F98431c8aD98523631AE4a59f267346ea31F984";

  const INonfungiblePositionManager = require("@uniswap/v3-periphery/artifacts/contracts/NonfungiblePositionManager.sol/NonfungiblePositionManager.json");
  const IPoolInitializer = require("@uniswap/v3-periphery/artifacts/contracts/interfaces/IPoolInitializer.sol/IPoolInitializer.json");
  const nonFungiblePositionManagerAddress = "0xC36442b4a4522E871399CD717aBDD847Ab11FE88";

  const SwapRouterArtifact = require("@uniswap/v3-periphery/artifacts/contracts/SwapRouter.sol/SwapRouter.json");
  const SwapRouterAddress = "0xE592427A0AEce92De3Edee1F18E0157C05861564";

  const QuoterArtifact = require("@uniswap/v3-periphery/artifacts/contracts/lens/Quoter.sol/Quoter.json");
  const QuoterAddress = "0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6";

  beforeEach(async () => {
    [creator, alice, bob, chad, dad] = await ethers.getSigners();
    addresses = [creator.address, alice.address, bob.address, chad.address, dad.address];
    const Token = await ethers.getContractFactory("TestToken");
    const Converter = await ethers.getContractFactory("ConverterV1_2");

    /*** Prepare
     * 1. create pool of tokenA/tokenB on UniswapV3
     * 2. put liquidity on the pool
     */

    tokenA = await Token.deploy(name, symbol, decimal);
    tokenB = await Token.deploy(name, symbol, decimal);

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
    poolAddress = receipt.events[0].data.slice(-40);

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
      deadline: 19238129083, //2579year
    };

    const mintTx = await nft.mint(mintParams);
    const mintReceipt = await mintTx.wait();
    const evt = mintReceipt.events.find((x) => x.event === "Transfer");
    tokenId = evt.args.tokenId;

    swap = await ethers.getContractAt(SwapRouterArtifact.abi, SwapRouterAddress);
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
    /***
     * swap tokenB to tokenA
     */
    it("success", async () => {
      console.log(poolAddress);
      console.log(tokenId);

      expect(await tokenA.balanceOf(alice.address)).to.equal(0);

      await tokenB._mint_for_testing(100);
      await tokenB.approve(converter.address, 100);
      await converter.swap_exact_to_insure(tokenB.address, 100, alice.address);

      expect(await tokenA.balanceOf(alice.address)).to.not.equal(0);
      console.log(await tokenA.balanceOf(alice.address));
    });
  });

  describe("getAmountsIn()", function () {
    /***
     *
     */
    it("success", async () => {
      let tx = await converter.getAmountsIn(tokenB.address, 90);
      let receipt = await tx.wait();
      console.log(receipt.events[0].args[3]);
    });
  });

  describe("swap_insure_to_exact()", function () {
    /***
     *
     */
    it("success", async () => {
      let tx = await converter.getAmountsIn(tokenB.address, 90);
      let receipt = await tx.wait();
      let amountIn = receipt.events[0].args[3];

      await tokenA._mint_for_testing(amountIn);
      await tokenA.approve(converter.address, amountIn);

      //alice has nothing before swap
      expect(await tokenB.balanceOf(alice.address)).to.equal(0);

      //swap
      await converter.swap_insure_to_exact(tokenB.address, 90, amountIn, alice.address);

      //swap 90 successfully
      expect(await tokenB.balanceOf(alice.address)).to.equal(90);
    });
  });
});
