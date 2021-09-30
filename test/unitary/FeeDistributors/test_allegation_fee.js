const { expect } = require("chai");
const { ethers } = require("hardhat");
const { BigNumber } = require('ethers');

describe('ReportingFeeDistributorV1', () => {
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
      const Distributor = await ethers.getContractFactory('ReportingDistributionV1');

      fee = await Token.deploy(name, simbol, decimal);
      rpt_token = await Token.deploy(name, simbol, rpt_decimal);
      dstr = await Distributor.deploy(rpt_token.address, fee.address, alice.address, creator.address);
    });

    describe("Condition", function () {
        it("contract should be deployed", async () => {
          await expect(fee.address).to.exist;
          await expect(rpt_token.address).to.exist;
          await expect(dstr.address).to.exist;
        });

        it("check parameters", async()=>{
            expect(await dstr.admin()).to.equal(creator.address);
            expect(await dstr.future_admin()).to.equal(ZERO_ADDRESS);
            expect(await dstr.recovery()).to.equal(alice.address);
            expect(await dstr.insure_reporting()).to.equal(rpt_token.address);
            expect(await dstr.token()).to.equal(fee.address);
        });
    });

    describe("test_set_allegation_fee", function(){
        it("successfully done", async()=>{
            //set allegation fee
            let new_allegation_fee = BigNumber.from("1000000");
            await dstr.set_allegation_fee(new_allegation_fee);
            
            //validate
            expect(await dstr.allegation_fee()).to.equal(new_allegation_fee);
        });

        it("reverted", async()=>{
            //set allegation fee
            let new_allegation_fee = BigNumber.from("1000000");
            await expect(dstr.connect(bob).set_allegation_fee(new_allegation_fee)).to.revertedWith("dev: admin only");


        })
    })


});