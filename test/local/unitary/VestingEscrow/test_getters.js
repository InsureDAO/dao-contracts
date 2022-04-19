const { expect } = require("chai");
const { ethers } = require("hardhat");
const { BigNumber } = require("ethers");

async function snapshot() {
  return network.provider.send("evm_snapshot", []);
}

async function restore(snapshotId) {
  return network.provider.send("evm_revert", [snapshotId]);
}

describe("VestingEscrow", function () {
  const YEAR = BigNumber.from(86400 * 365);

  const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
  const ten_to_the_21 = BigNumber.from("1000000000000000000000");
  const ten_to_the_20 = BigNumber.from("100000000000000000000");
  const ten_to_the_17 = BigNumber.from("100000000000000000");

  describe("test_getters", function () {
    before(async () => {
      [creator, alice, bob, chad, tom, noone, seven, eight, nine, ten] = await ethers.getSigners();
      let accounts = [
        creator.address,
        alice.address,
        bob.address,
        chad.address,
        tom.address,
        noone.address,
        seven.address,
        eight.address,
        nine.address,
        ten.address,
      ];
      const VestingEscrow = await ethers.getContractFactory("VestingEscrow");
      const TestToken = await ethers.getContractFactory("TestToken");

      //deploy TestToken and VestingEscrow. Then mint and approve VestingEscrow to Vest 10**21 tokens.
      let now = BigNumber.from((await ethers.provider.getBlock("latest")).timestamp);
      start_time = now.add(BigNumber.from("1000")).add(YEAR);
      end_time = start_time.add(BigNumber.from("100000000"));

      coin_a = await TestToken.deploy("Coin A", "USDA", 18);
      vesting = await VestingEscrow.deploy(coin_a.address, start_time, end_time, true, [
        alice.address,
        bob.address,
        chad.address,
        tom.address,
      ]);

      await coin_a._mint_for_testing(ten_to_the_21);
      await coin_a.approve(vesting.address, ten_to_the_21);

      await vesting.add_tokens(ten_to_the_21, { from: accounts[0] });
      expect(await vesting.unallocated_supply()).to.equal(ten_to_the_21); //ok

      reducer = (accumulator, currentValue) => accumulator.add(currentValue);

      recipients = [];
      for (let i = 0; i < 100; i++) {
        if (i < 10) {
          recipients.push(accounts[i]);
        } else {
          recipients.push(ZERO_ADDRESS);
        }
      }

      amounts = [ten_to_the_17];
      for (let i = 0; i < 99; i++) {
        if (i < 9) {
          amounts.push(amounts[i].add(ten_to_the_17));
        } else {
          amounts.push(BigNumber.from("0"));
        }
      }
      //vest accounts[]
      await vesting.fund(recipients, amounts, { from: accounts[0] });

      //vested
      expect(await vesting.initial_locked(accounts[0])).to.equal(ten_to_the_17); //ok
      expect(await vesting.initial_locked(accounts[1])).to.equal(ten_to_the_17.mul(BigNumber.from("2"))); //ok
      expect(await vesting.initial_locked(accounts[9])).to.equal(ten_to_the_17.mul(BigNumber.from("10"))); //ok
      //expect(await vesting.initial_locked_supply()).to.equal(amounts.reduce(reducer));//ok
    });

    beforeEach(async () => {
      snapshotId = await snapshot();
    });

    afterEach(async () => {
      await restore(snapshotId);
    });

    it("test_vested_supply", async () => {
      expect(await vesting.vestedSupply()).to.equal(BigNumber.from("0"));

      await ethers.provider.send("evm_setNextBlockTimestamp", [end_time.toNumber()]);
      await ethers.provider.send("evm_mine");

      expect(await vesting.vestedSupply()).to.equal(amounts.reduce(reducer));
    });

    it("test_locked_supply", async () => {
      //all fund is locked
      expect(await vesting.lockedSupply()).to.equal(amounts.reduce(reducer));

      //skip to the end_time
      await ethers.provider.send("evm_setNextBlockTimestamp", [end_time.toNumber()]);
      await ethers.provider.send("evm_mine");

      //all fund isn't locked
      expect(await vesting.lockedSupply()).to.equal(BigNumber.from("0"));
    });

    it("test_vested_of", async () => {
      //all fund is locked
      expect(await vesting.vestedOf(creator.address)).to.equal(BigNumber.from("0"));

      //skip to the end_time
      await ethers.provider.send("evm_setNextBlockTimestamp", [end_time.toNumber()]);
      await ethers.provider.send("evm_mine");

      //all fund isn't locked
      expect(await vesting.vestedOf(creator.address)).to.equal(amounts[0]);
    });

    it("test_locked_of", async () => {
      //all fund is locked
      expect(await vesting.lockedOf(creator.address)).to.equal(amounts[0]);

      //skip to the end_time
      await ethers.provider.send("evm_setNextBlockTimestamp", [end_time.toNumber()]);
      await ethers.provider.send("evm_mine");

      //all fund isn't locked
      expect(await vesting.lockedOf(creator.address)).to.equal(BigNumber.from("0"));
    });

    it("test_balance_of", async () => {
      //all fund is locked
      expect(await vesting.balanceOf(creator.address)).to.equal(BigNumber.from("0"));

      //skip to the end_time
      await ethers.provider.send("evm_setNextBlockTimestamp", [end_time.toNumber()]);
      await ethers.provider.send("evm_mine");

      //all fund isn't locked
      expect(await vesting.balanceOf(creator.address)).to.equal(amounts[0]);

      await vesting.claim(creator.address);
      expect(await vesting.balanceOf(creator.address)).to.equal(BigNumber.from("0"));
    });
  });
});
