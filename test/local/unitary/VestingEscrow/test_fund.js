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

  describe("test_fund", function () {
    before(async () => {
      [creator, alice, bob, chad, tom, noone, seven, eight, nine, ten] = await ethers.getSigners();
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

      await vesting.add_tokens(ten_to_the_21);
      expect(await vesting.unallocated_supply()).to.equal(ten_to_the_21);
    });

    beforeEach(async () => {
      snapshotId = await snapshot();
    });

    afterEach(async () => {
      await restore(snapshotId);
    });

    it("test_balanceOf", async () => {
      expect(await coin_a.balanceOf(vesting.address)).to.equal(ten_to_the_21);
    });

    it("test_initial_locked_supply", async () => {
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
      recipients = [accounts[0]];
      let i;
      for (i = 1; i < 100; i++) {
        if (i < 10) {
          recipients.push(accounts[i]);
        } else {
          recipients.push(ZERO_ADDRESS);
        }
      }

      allocation = [ten_to_the_17];
      let t;
      for (t = 1; t < 100; t++) {
        if (t < 10) {
          allocation.push(allocation[t - 1].add(ten_to_the_17));
        } else {
          allocation.push(BigNumber.from("0"));
        }
      }
      await vesting.fund(recipients, allocation);

      const reducer = (accumulator, currentValue) => accumulator.add(currentValue);
      expect(await vesting.initial_locked_supply()).to.equal(allocation.reduce(reducer));
    });

    it("test_unallocated_supply", async () => {
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
      recipients = [accounts[0]];
      let i;
      for (i = 1; i < 100; i++) {
        if (i < 10) {
          recipients.push(accounts[i]);
        } else {
          recipients.push(ZERO_ADDRESS);
        }
      }

      allocation = [ten_to_the_17];
      let t;
      for (t = 1; t < 100; t++) {
        if (t < 10) {
          allocation.push(allocation[t - 1].add(ten_to_the_17));
        } else {
          allocation.push(BigNumber.from("0"));
        }
      }
      await vesting.fund(recipients, allocation);

      const reducer = (accumulator, currentValue) => accumulator.add(currentValue);
      expect(await vesting.unallocated_supply()).to.equal(ten_to_the_21.sub(allocation.reduce(reducer)));
    });

    it("test_initial_locked", async () => {
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
      recipients = [accounts[0]];
      let i;
      for (i = 1; i < 100; i++) {
        if (i < 10) {
          recipients.push(accounts[i]);
        } else {
          recipients.push(ZERO_ADDRESS);
        }
      }
      allocation = [ten_to_the_17];
      let t;
      for (t = 1; t < 100; t++) {
        if (t < 10) {
          allocation.push(allocation[t - 1].add(ten_to_the_17));
        } else {
          allocation.push(BigNumber.from("0"));
        }
      }

      await vesting.fund(recipients, allocation);

      let x;
      for (x = 0; x < 100; x++) {
        let acct = recipients[x];
        let expected_amount = allocation[x];
        expect(await vesting.initial_locked(acct)).to.equal(expected_amount);
      }
    });

    it("test_partial_recipients", async () => {
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
      recipients = [accounts[0]];
      let i;
      for (i = 1; i < 100; i++) {
        if (i < 5) {
          recipients.push(accounts[i]);
        } else {
          recipients.push(ZERO_ADDRESS);
        }
      }
      allocation = [ten_to_the_17];
      let t;
      for (t = 1; t < 100; t++) {
        if (t < 50) {
          allocation.push(allocation[t - 1].add(ten_to_the_17));
        } else {
          allocation.push(BigNumber.from("0"));
        }
      }

      await vesting.fund(recipients, allocation);

      let x;
      let expected_amount = BigNumber.from("0");
      for (x = 0; x < 5; x++) {
        expected_amount = expected_amount.add(allocation[x]);
      }
      expect(await vesting.initial_locked_supply()).to.equal(expected_amount);
    });

    it("test_one_recipient", async () => {
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
      recipients = [accounts[0]];
      let i;
      for (i = 1; i < 100; i++) {
        if (i < 5) {
          recipients.push(accounts[i]);
        } else {
          recipients.push(ZERO_ADDRESS);
        }
      }
      allocation = [ten_to_the_20];
      let t;
      for (t = 1; t < 100; t++) {
        if (t < 1) {
          allocation.push(allocation[t - 1].add(ten_to_the_20));
        } else {
          allocation.push(BigNumber.from("0"));
        }
      }

      await vesting.fund(recipients, allocation);

      expect(await vesting.initial_locked_supply()).to.equal(ten_to_the_20);
    });

    it("test_multiple_calls_different_recipients", async () => {
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
      recipients = [accounts[5]];
      let i;
      for (i = 1; i < 100; i++) {
        if (i < 1) {
          recipients.push(accounts[i]);
        } else {
          recipients.push(ZERO_ADDRESS);
        }
      }
      allocation = [ten_to_the_20];
      let t;
      for (t = 1; t < 100; t++) {
        if (t < 2) {
          allocation.push(allocation[t - 1].add(ten_to_the_20));
        } else {
          allocation.push(BigNumber.from("0"));
        }
      }

      await vesting.fund(recipients, allocation);

      recipients[0] = accounts[4];
      recipients[1] = accounts[6];
      await vesting.fund(recipients, allocation);

      expect(await vesting.initial_locked_supply()).to.equal(ten_to_the_20.mul(BigNumber.from("4")));
      expect(await vesting.unallocated_supply()).to.equal(ten_to_the_21.sub(ten_to_the_20.mul(BigNumber.from("4"))));
      expect(await vesting.initial_locked(accounts[4])).to.equal(ten_to_the_20);
      expect(await vesting.initial_locked(accounts[5])).to.equal(ten_to_the_20);
      expect(await vesting.initial_locked(accounts[6])).to.equal(ten_to_the_20.mul(BigNumber.from("2")));
    });

    it("test_multiple_calls_same_recipients", async () => {
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
      recipients = [accounts[5]];
      let i;
      for (i = 1; i < 100; i++) {
        if (i < 1) {
          recipients.push(accounts[i]);
        } else {
          recipients.push(ZERO_ADDRESS);
        }
      }
      allocation = [ten_to_the_20.mul(BigNumber.from("2"))];
      let t;
      for (t = 1; t < 100; t++) {
        if (t < 1) {
          allocation.push(allocation[t - 1].add(ten_to_the_20));
        } else {
          allocation.push(BigNumber.from("0"));
        }
      }

      await vesting.fund(recipients, allocation);

      allocation[0] = ten_to_the_20;
      await vesting.fund(recipients, allocation);

      expect(await vesting.initial_locked_supply()).to.equal(ten_to_the_20.mul(BigNumber.from("3")));
      expect(await vesting.unallocated_supply()).to.equal(ten_to_the_21.sub(ten_to_the_20.mul(BigNumber.from("3"))));
      expect(await vesting.initial_locked(accounts[5])).to.equal(ten_to_the_20.mul(BigNumber.from("3")));
    });

    it("test_admin_only", async () => {
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
      recipients = [accounts[5]];
      let i;
      for (i = 1; i < 100; i++) {
        if (i < 1) {
          recipients.push(accounts[i]);
        } else {
          recipients.push(ZERO_ADDRESS);
        }
      }
      allocation = [ten_to_the_20.mul(BigNumber.from("2"))];
      let t;
      for (t = 1; t < 100; t++) {
        if (t < 1) {
          allocation.push(allocation[t - 1].add(ten_to_the_20));
        } else {
          allocation.push(BigNumber.from("0"));
        }
      }

      await expect(vesting.connect(seven).fund(recipients, allocation)).to.revertedWith("dev admin only");
    });

    it("test_over_allocation", async () => {
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

      recipients = [accounts[5]];
      let i;
      for (i = 1; i < 100; i++) {
        if (i < 1) {
          recipients.push(accounts[i]);
        } else {
          recipients.push(ZERO_ADDRESS);
        }
      }
      allocation = [ten_to_the_21.add(BigNumber.from("1"))];
      let t;
      for (t = 1; t < 100; t++) {
        if (t < 1) {
          allocation.push(allocation[t - 1].add(ten_to_the_20));
        } else {
          allocation.push(BigNumber.from("0"));
        }
      }

      await expect(vesting.fund(recipients, allocation)).to.reverted;
    });

    it("test_fund_admin", async () => {
      let accounts = [creator, alice, bob, chad, tom, noone, seven, eight, nine, ten];

      recipients = [accounts[5].address];
      let i;
      for (i = 1; i < 100; i++) {
        if (i < 1) {
          recipients.push(accounts[i].address);
        } else {
          recipients.push(ZERO_ADDRESS);
        }
      }
      allocation = [ten_to_the_20];
      let t;
      for (t = 1; t < 100; t++) {
        if (t < 1) {
          allocation.push(allocation[t - 1].add(ten_to_the_20));
        } else {
          allocation.push(BigNumber.from("0"));
        }
      }

      for (let x = 0; x < 10; x++) {
        if (x < 5) {
          await vesting.connect(accounts[x]).fund(recipients, allocation);
        } else {
          await expect(vesting.connect(accounts[x]).fund(recipients, allocation)).to.revertedWith("dev admin only");
        }
      }
    });

    it("test_disable_fund_admin", async () => {
      let accounts = [creator, alice, bob, chad, tom, noone, seven, eight, nine, ten];

      await expect(vesting.connect(accounts[1]).disable_fund_admins()).to.revertedWith("dev admin only");

      await vesting.connect(accounts[0]).disable_fund_admins();

      recipients = [accounts[5].address];
      let i;
      for (i = 1; i < 100; i++) {
        if (i < 1) {
          recipients.push(accounts[i].address);
        } else {
          recipients.push(ZERO_ADDRESS);
        }
      }
      allocation = [ten_to_the_20];
      let t;
      for (t = 1; t < 100; t++) {
        if (t < 1) {
          allocation.push(allocation[t - 1].add(ten_to_the_20));
        } else {
          allocation.push(BigNumber.from("0"));
        }
      }

      await expect(vesting.connect(accounts[3]).fund(recipients, allocation)).to.revertedWith(
        "dev fund admins disabled"
      );
    });
  });
});
