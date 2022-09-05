const { expect } = require("chai");
const { ethers } = require("hardhat");
const { BigNumber } = require("ethers");

describe("ReportingFeeDistributor", () => {
  const name = "Fee Token";
  const symbol = "FT";
  const decimal = 18;
  const rpt_decimal = 0;

  const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
  const FEE = BigNumber.from("1000000");

  beforeEach(async () => {
    [creator, alice, bob, chad, dad] = await ethers.getSigners();
    addresses = [creator.address, alice.address, bob.address, chad.address, dad.address];

    const Ownership = await ethers.getContractFactory("Ownership");
    const Token = await ethers.getContractFactory("TestToken");
    const Distributor = await ethers.getContractFactory("ReportingFeeDistributor");

    ownership = await Ownership.deploy();
    fee = await Token.deploy(name, symbol, decimal);
    rpt_token = await Token.deploy(name, symbol, rpt_decimal);
    dstr = await Distributor.deploy(rpt_token.address, alice.address, ownership.address, fee.address);
  });

  describe("Condition", function () {
    it("contract should be deployed", async () => {
      await expect(fee.address).to.exist;
      await expect(rpt_token.address).to.exist;
      await expect(dstr.address).to.exist;
    });

    it("check parameters", async () => {
      expect(await dstr.ownership()).to.equal(ownership.address);
      expect(await dstr.recovery()).to.equal(alice.address);
      expect(await dstr.insure_reporting()).to.equal(rpt_token.address);
      expect(await dstr.token()).to.equal(fee.address);
    });
  });

  describe("test_set_allegation_fee", function () {
    it("successfully done", async () => {
      //set allegation fee
      let new_allegation_fee = BigNumber.from("1000000");
      await dstr.set_allegation_fee(new_allegation_fee);

      //validate
      expect(await dstr.allegation_fee()).to.equal(new_allegation_fee);
    });

    it("test_admin_only", async () => {
      //set allegation fee
      let new_allegation_fee = BigNumber.from("1000000");
      await expect(dstr.connect(bob).set_allegation_fee(new_allegation_fee)).to.revertedWith(
        "Caller is not allowed to operate"
      );
    });
  });

  describe("test_pay_allegation_fee", function () {
    it("successfully done", async () => {
      //set allegation fee
      let new_allegation_fee = BigNumber.from("1000000");
      await dstr.set_allegation_fee(new_allegation_fee);

      //mint => approve
      await fee._mint_for_testing(new_allegation_fee);
      await fee.approve(dstr.address, new_allegation_fee);

      expect(await dstr.bonus_total()).to.equal(0);

      await dstr.pay_allegation_fee();
    });

    it("successfully done 2", async () => {
      //set allegation fee
      let new_allegation_fee = BigNumber.from("1000000");
      await dstr.set_allegation_fee(new_allegation_fee);

      //mint => approve
      await fee.connect(alice)._mint_for_testing(new_allegation_fee);
      await fee.connect(alice).approve(dstr.address, new_allegation_fee);

      expect(await dstr.bonus_total()).to.equal(0);

      await dstr.connect(alice).pay_allegation_fee();
    });

    /**
        it("transfer fail", async()=>{
            //set allegation fee
            let new_allegation_fee = BigNumber.from("1000000");
            await dstr.set_allegation_fee(new_allegation_fee);
            
            //mint => approve
            await fee._mint_for_testing(new_allegation_fee.sub(1));
            await fee.approve(dstr.address, new_allegation_fee);
            expect(await dstr.pay_allegation_fee()).to.reverted;
        })
        */
  });
});
