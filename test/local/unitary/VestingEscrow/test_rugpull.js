const { expect } = require("chai");
const { ethers } = require("hardhat");
const { BigNumber } = require("ethers");

const DAY = BigNumber.from(86400);
async function snapshot() {
  return network.provider.send("evm_snapshot", []);
}

async function restore(snapshotId) {
  return network.provider.send("evm_revert", [snapshotId]);
}

async function now() {
  let now = (await ethers.provider.getBlock("latest")).timestamp;
  return now;
}

async function moveForwardPeriods(days) {
  await ethers.provider.send("evm_increaseTime", [DAY.mul(days).toNumber()]);
  await ethers.provider.send("evm_mine");

  return true;
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
    start_time = now.add(DAY);
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

  describe("rug_pull", function () {
    it("test_rugpull_success", async () => {
      expect(await coin_a.balanceOf(creator.address)).to.equal("0");
      expect(await vesting.disabled_at(alice.address)).to.equal("0");
      expect(await vesting.is_ragged(alice.address)).to.equal(false);

      await vesting.rug_pull(alice.address);

      expect(await coin_a.balanceOf(creator.address)).to.equal(ten_to_the_20); //rugged
      expect(await vesting.disabled_at(alice.address)).to.not.equal("0");
      expect(await vesting.is_ragged(alice.address)).to.equal(true);
    });

    it("test_rugpull_success_after_starttime", async () => {
      moveForwardPeriods(1);

      expect(await coin_a.balanceOf(creator.address)).to.equal("0");
      expect(await vesting.disabled_at(alice.address)).to.equal("0");
      expect(await vesting.is_ragged(alice.address)).to.equal(false);

      let tx = await vesting.rug_pull(alice.address);
      let rugged_amount = (await tx.wait()).events[1].args["rugged"];

      expect(await coin_a.balanceOf(creator.address)).to.equal(rugged_amount); //rugged
      expect(await vesting.disabled_at(alice.address)).to.not.equal("0");
      expect(await vesting.is_ragged(alice.address)).to.equal(true);
    });

    it("test_rugpull_admin_only", async () => {
      await expect(vesting.connect(alice).rug_pull(alice.address)).to.revertedWith("onlyOwner");
    });

    it("test_cannot_toggle_disable_after_rugpull", async () => {
      await vesting.rug_pull(alice.address);

      await expect(vesting.toggle_disable(alice.address)).to.revertedWith("is rugged");
    });

    it("return 0 after rugged", async () => {
      expect(await vesting.lockedOf(alice.address)).to.not.equal("0");
      await vesting.rug_pull(alice.address);

      expect(await vesting.lockedOf(alice.address)).to.equal("0");
    });

    it("return 0 after rugged, claimed", async () => {
      moveForwardPeriods(1);

      expect(await vesting.balanceOf(alice.address)).to.not.equal("0");

      await vesting.rug_pull(alice.address);

      expect(await vesting.balanceOf(alice.address)).to.not.equal("0");

      await vesting.claim(alice.address);

      expect(await vesting.balanceOf(alice.address)).to.equal("0");
    });
  });
});
