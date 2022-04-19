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
  before(async () => {
    [creator, alice, bob, chad, tom, noone] = await ethers.getSigners();
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

    let recipients = [alice.address];
    let i;
    for (i = 0; i < 99; i++) {
      recipients.push(ZERO_ADDRESS);
    }

    let allocation = [ten_to_the_20];
    let t;
    for (t = 0; t < 99; t++) {
      allocation.push(BigNumber.from("0"));
    }

    await vesting.add_tokens(ten_to_the_21);
    expect(await vesting.unallocated_supply()).to.equal(ten_to_the_21);

    //allocate funds
    await vesting.fund(recipients, allocation);
    //check if allocated correctly
    expect(await vesting.initial_locked_supply()).to.equal(ten_to_the_20);
    expect(await vesting.initial_locked(alice.address)).to.equal(ten_to_the_20);
    expect(await vesting.unallocated_supply()).to.equal(ten_to_the_21.sub(ten_to_the_20));
  });

  beforeEach(async () => {
    snapshotId = await snapshot();
  });

  afterEach(async () => {
    await restore(snapshotId);
  });

  describe("test_disable_and_claim", function () {
    it("test_disable_after_end_time", async () => {
      await ethers.provider.send("evm_setNextBlockTimestamp", [end_time.toNumber()]);

      await vesting.toggle_disable(alice.address);
      await vesting.connect(alice).claim(alice.address);

      expect(await coin_a.balanceOf(alice.address)).to.equal(ten_to_the_20);
    });

    it("test_disable_before_start_time", async () => {
      await vesting.toggle_disable(alice.address);

      await ethers.provider.send("evm_setNextBlockTimestamp", [end_time.toNumber()]);
      await vesting.connect(alice).claim(alice.address);

      expect(await coin_a.balanceOf(alice.address)).to.equal(BigNumber.from("0"));
    });

    it("test_disable_before_start_time_and_reenable", async () => {
      await vesting.toggle_disable(alice.address);
      await ethers.provider.send("evm_setNextBlockTimestamp", [end_time.toNumber()]);
      await vesting.toggle_disable(alice.address);

      await vesting.connect(alice).claim(alice.address);
      expect(await coin_a.balanceOf(alice.address)).to.equal(ten_to_the_20);
    });

    it("test_disable_partially_unvested", async () => {
      await ethers.provider.send("evm_setNextBlockTimestamp", [start_time.toNumber()]);
      await ethers.provider.send("evm_increaseTime", [31337]);

      await vesting.toggle_disable(alice.address);
      let timestamp = BigNumber.from((await ethers.provider.getBlock("latest")).timestamp);

      await ethers.provider.send("evm_setNextBlockTimestamp", [end_time.toNumber()]);
      await vesting.connect(alice).claim(alice.address);

      let expected = ten_to_the_20.mul(timestamp.sub(start_time)).div(end_time.sub(start_time)).or(BigNumber.from("0"));

      expect(await coin_a.balanceOf(alice.address)).to.equal(expected);
      expect(await vesting.total_claimed(alice.address)).to.equal(expected);
    });

    it("test_disable_multiple_partial", async () => {
      await ethers.provider.send("evm_setNextBlockTimestamp", [start_time.toNumber()]);
      await ethers.provider.send("evm_increaseTime", [31337]);
      await vesting.toggle_disable(alice.address);

      await ethers.provider.send("evm_increaseTime", [31337]);
      await vesting.connect(alice).claim(alice.address);

      await vesting.toggle_disable(alice.address);
      await vesting.toggle_disable(alice.address);
      let timestamp = BigNumber.from((await ethers.provider.getBlock("latest")).timestamp);

      await ethers.provider.send("evm_setNextBlockTimestamp", [end_time.toNumber()]);
      await vesting.connect(alice).claim(alice.address);

      let expected = ten_to_the_20.mul(timestamp.sub(start_time)).div(end_time.sub(start_time)).or(BigNumber.from("0"));

      expect(await coin_a.balanceOf(alice.address)).to.equal(expected);
      expect(await vesting.total_claimed(alice.address)).to.equal(expected);
    });
  });
});
