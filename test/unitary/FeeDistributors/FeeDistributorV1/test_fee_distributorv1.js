const { expect } = require("chai");
const { ethers } = require("hardhat");
const { BigNumber } = require('ethers');

describe('FeeDistributorV1', () => {
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
      const Converter = await ethers.getContractFactory('TestConverter');
      const Distributor = await ethers.getContractFactory('FeeDistributorV1');

      insure = await Token.deploy(name, simbol, decimal);
      converter = await Converter.deploy(insure.address);
      dstr = await Distributor.deploy(insure.address, converter.address);
    });

    describe("Condition", function () {
        it("contract should be deployed", async () => {
          await expect(insure.address).to.exist;
          await expect(converter.address).to.exist;
          await expect(dstr.address).to.exist;
        });

    });
});