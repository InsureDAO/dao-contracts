const { expect } = require("chai");
const { ethers } = require("hardhat");
const { BigNumber } = require('ethers');

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
      const Distributor = await ethers.getContractFactory('DevFeeForwarder');

      token = await Token.deploy(name, simbol, decimal);
      dstr = await Distributor.deploy(alice.address);
    });

    describe("Condition", function () {
        it("contract should be deployed", async () => {
            console.log(creator.address);

        });
    });
});