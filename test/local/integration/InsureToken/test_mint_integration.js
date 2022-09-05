const { expect } = require("chai");
const { ethers } = require("hardhat");
const { BigNumber } = require("ethers");

describe("InsureToken", function () {
  const name = "InsureToken";
  const symbol = "Insure";
  const decimal = 18;

  const DAY = BigNumber.from(86400);
  const WEEK = BigNumber.from(86400 * 7);
  const YEAR = BigNumber.from(86400 * 365);

  const INITIAL_SUPPLY = BigNumber.from("126000000000000000000000000");
  const INITIAL_RATE = BigNumber.from("28000000").mul(BigNumber.from("10").pow("18")).div(YEAR);

  const YEAR_1_SUPPLY = INITIAL_RATE.mul(YEAR);

  //return random integer between min and max
  function ramdom_duration(min, max) {
    let rdm = Math.floor(Math.random() * (max - min) + min);

    console.log("duration: " + rdm);
    return rdm;
  }

  describe("test_mint_integration", function () {
    beforeEach(async () => {
      //import
      [creator, alice, bob] = await ethers.getSigners();

      const Ownership = await ethers.getContractFactory("Ownership");
      const Token = await ethers.getContractFactory("InsureToken");
      ownership = await Ownership.deploy();
      Insure = await Token.deploy(name, symbol, ownership.address);

      //* from: initial_setup
      await ethers.provider.send("evm_increaseTime", [DAY.toNumber()]);
      await Insure.update_mining_parameters(); //mining_epoch -1 => 0
    });

    it("test_mint", async () => {
      let times = BigNumber.from(ramdom_duration(1, 7).toString());

      let t0 = await Insure.start_epoch_time();

      let now = BigNumber.from((await ethers.provider.getBlock("latest")).timestamp);
      let t1 = now.add(BigNumber.from("10").pow(times));
      await ethers.provider.send("evm_setNextBlockTimestamp", [t1.toNumber()]);

      if (t1.sub(t0).gte(YEAR)) {
        await Insure.update_mining_parameters();
      } else {
        await ethers.provider.send("evm_mine");
      }

      let available_supply = await Insure.available_supply();
      let mintable = await Insure.mintable_in_timeframe(t0, t1);

      let actual_mintable = available_supply.sub(INITIAL_SUPPLY);

      expect(actual_mintable.gte(mintable)).to.be.equal(true);
      if (t1 == t0) {
        expect(mintable).to.equal(BigNumber.from("0"));
      } else {
        expect(available_supply.sub(INITIAL_SUPPLY).div(mintable)).to.equal(BigNumber.from("1"));
      }
    });

    it("test_random_range_year_one", async () => {
      //get random
      let time1 = BigNumber.from(ramdom_duration(0, 31536000).toString());
      let time2 = BigNumber.from(ramdom_duration(0, 31536000).toString());

      //setup
      let creation_time = await Insure.start_epoch_time();
      let start;
      let end;

      if (time1.gt(time2)) {
        start = creation_time.add(time2);
        end = creation_time.add(time1);
      } else {
        start = creation_time.add(time1);
        end = creation_time.add(time2);
      }

      let rate = YEAR_1_SUPPLY.div(YEAR);

      expect(await Insure.mintable_in_timeframe(start, end)).to.equal(rate.mul(end.sub(start)));
    });

    it("test_available_supply", async () => {
      //---------generate random# -------------//
      let min = 1;
      let max = 31536000;
      let duration = ramdom_duration(min, max);
      //---------------------------------------//

      let creation_time = await Insure.start_epoch_time();
      let initial_supply = await Insure.totalSupply();
      let rate = await Insure.rate();

      await ethers.provider.send("evm_increaseTime", [duration]);

      let now = BigNumber.from((await ethers.provider.getBlock("latest")).timestamp);
      let expected = initial_supply.add(now.sub(creation_time).mul(rate));
      expect(await Insure.available_supply()).to.equal(expected);
    });
  });
});
