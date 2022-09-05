const { expect } = require("chai");
const { ethers } = require("hardhat");
const { BigNumber } = require("ethers");

const { ZERO_ADDRESS, YEAR, WEEK, DAY, ZERO, INFLATION_DELAY } = require("../../constant-utils");

async function snapshot() {
  return network.provider.send("evm_snapshot", []);
}

async function restore(snapshotId) {
  return network.provider.send("evm_revert", [snapshotId]);
}

async function moveForwardPeriods(days) {
  await ethers.provider.send("evm_increaseTime", [DAY.mul(days).toNumber()]);
  await ethers.provider.send("evm_mine");

  return true;
}

async function now() {
  return BigNumber.from((await ethers.provider.getBlock("latest")).timestamp);
}

async function setNextBlock(time) {
  await ethers.provider.send("evm_setNextBlockTimestamp", [time.toNumber()]);
}

describe("InsureToken", function () {
  describe("test_epoch_time_supply", function () {
    const YEAR = BigNumber.from(86400 * 365);
    const WEEK = BigNumber.from(86400 * 7);
    const DAY = BigNumber.from(86400);
    const zero = BigNumber.from("0");

    const name = "InsureToken";
    const symbol = "Insure";
    const decimal = 18;

    const INITIAL_SUPPLY = BigNumber.from("126000000000000000000000000");
    const INITIAL_RATE = BigNumber.from("28000000").mul(BigNumber.from("10").pow("18")).div(YEAR);

    before(async () => {
      [creator, alice, bob] = await ethers.getSigners();
      const Token = await ethers.getContractFactory("InsureToken");
      const Ownership = await ethers.getContractFactory("Ownership");

      ownership = await Ownership.deploy();
      Insure = await Token.deploy(name, symbol, ownership.address);
    });
    beforeEach(async () => {
      snapshotId = await snapshot();
    });

    afterEach(async () => {
      await restore(snapshotId);
    });

    //------ epoch_time_wirte -------//
    it("test_start_epoch_time_write", async () => {
      let creation_time = await Insure.start_epoch_time(); //Last years tomorrow
      let expected_time = creation_time.add(YEAR); //Tomorrow

      await ethers.provider.send("evm_setNextBlockTimestamp", [expected_time.add(WEEK).toNumber()]); //baundary: expected_time

      await Insure.start_epoch_time_write();
      expect(await Insure.start_epoch_time()).to.equal(expected_time);
    });

    it("test_start_epoch_time_write_same_epoch", async () => {
      //calling `start_epoch_token_write` within the same epoch should not raise
      expect(await Insure.start_epoch_time_write()).to.be.a("Object");
      expect(await Insure.start_epoch_time_write()).to.be.a("Object");
    });

    //--------- update_mining_parameter ------//
    it("test_update_mining_parameters", async () => {
      let creation_time = await Insure.start_epoch_time();
      let new_epoch = creation_time.add(YEAR);

      await ethers.provider.send("evm_setNextBlockTimestamp", [new_epoch.toNumber()]);

      //mining epoch change
      expect(await Insure.mining_epoch()).to.equal("-1");
      await Insure.update_mining_parameters(); //mining_epoch -1 => 0
      expect(await Insure.mining_epoch()).to.equal("0");

      //Infration begin
      expect(await Insure.rate()).to.equal(INITIAL_RATE);
    });

    it("test_update_mining_parameters_same_epoch", async () => {
      let creation_time = await Insure.start_epoch_time();
      let new_epoch = creation_time.add(YEAR);

      await ethers.provider.send("evm_setNextBlockTimestamp", [new_epoch.sub("1").toNumber()]);

      await expect(Insure.update_mining_parameters()).to.revertedWith("dev: too soon!");
    });

    //----- mintable_in_timeframe -----//
    it("test_mintable_in_timeframe_end_before_start", async () => {
      let creation_time = await Insure.start_epoch_time();

      await expect(Insure.update_mining_parameters()).to.revertedWith("dev: too soon!");
    });

    it("test_mintable_in_timeframe_multiple_epochs", async () => {
      let creation_time = await Insure.start_epoch_time();

      //two epoch should not raise
      await Insure.mintable_in_timeframe(creation_time, creation_time.add(YEAR.mul("19").div("10")));

      //three epoch should raise
      await expect(
        Insure.mintable_in_timeframe(creation_time, creation_time.add(YEAR.mul("21").div("10")))
      ).to.revertedWith("dev: too far in future");
    });

    it("test_mintable_in_timeframe_multiple_epochs", async () => {
      let creation_time = await Insure.start_epoch_time();

      await moveForwardPeriods(1); //INFURATION_DELAY
      await Insure.update_mining_parameters();
      expect(await Insure.mining_epoch()).to.equal("0");

      await moveForwardPeriods(365); //RATE_REDUCTION_TIME
      await Insure.update_mining_parameters();
      expect(await Insure.mining_epoch()).to.equal("1");

      await moveForwardPeriods(365); //RATE_REDUCTION_TIME
      await Insure.update_mining_parameters();
      expect(await Insure.mining_epoch()).to.equal("2");

      let time = await now();

      await Insure.mintable_in_timeframe(creation_time, time.add(YEAR.mul("19").div("10")));
    });

    it("test_mintable_in_timeframe_this_epoch", async () => {
      let creation_time = await Insure.start_epoch_time();

      await moveForwardPeriods(1); //INFURATION_DELAY
      await Insure.update_mining_parameters();
      expect(await Insure.mining_epoch()).to.equal("0");

      let time = await now();

      let mintable = await Insure.mintable_in_timeframe(time, time.add(WEEK));
      let expection = (await Insure.RATES(0)).mul(WEEK);

      expect(mintable).to.equal(expection);
    });

    it("test_mintable_in_timeframe_next_epoch", async () => {
      let creation_time = await Insure.start_epoch_time();

      await moveForwardPeriods(1); //INFURATION_DELAY
      await Insure.update_mining_parameters();
      expect(await Insure.mining_epoch()).to.equal("0");

      let time = await now();

      let mintable = await Insure.mintable_in_timeframe(time.add(YEAR), time.add(YEAR).add(WEEK));
      let expection = (await Insure.RATES(1)).mul(WEEK);

      expect(mintable).to.equal(expection);
    });

    it("test_mintable_in_timeframe_over_epoch", async () => {
      await moveForwardPeriods(1); //INFURATION_DELAY
      await Insure.update_mining_parameters();
      expect(await Insure.mining_epoch()).to.equal("0");

      let zero_start = await Insure.start_epoch_time();
      let next_epoch = zero_start.add(YEAR);
      await moveForwardPeriods(363);

      let time = await now();

      expect(next_epoch).gt(time);

      let diff = next_epoch.sub(time);
      let time2 = time.add(diff).add(diff);

      /**
       * epoch0        epoch1
       * ----|--------|--------|-------
       *        diff     diff
       *   time1              time2
       *
       */

      let mintable = await Insure.mintable_in_timeframe(time, time2);

      let expect1 = (await Insure.RATES(0)).mul(diff);
      let expect2 = (await Insure.RATES(1)).mul(diff);
      let expection = expect1.add(expect2);

      expect(mintable).to.equal(expection);
    });

    it("test_available_supply", async () => {
      //within the epoch
      await ethers.provider.send("evm_increaseTime", [DAY.toNumber()]);

      await Insure.update_mining_parameters(); //mining_epoch -1 => 0
      expect(await Insure.mining_epoch()).to.equal("0");

      let creation_time = await Insure.start_epoch_time();
      let initial_supply = await Insure.totalSupply();
      let rate = await Insure.rate();

      await ethers.provider.send("evm_increaseTime", [WEEK.toNumber()]);

      let now = BigNumber.from((await ethers.provider.getBlock("latest")).timestamp);
      let expected = initial_supply.add(rate.mul(now.sub(creation_time)));

      expect(rate).to.not.equal(zero);
      expect(initial_supply).to.not.equal(zero);
      expect(await Insure.available_supply()).to.not.equal(zero);
      expect(await Insure.available_supply()).to.equal(expected);
    });
  });
});
