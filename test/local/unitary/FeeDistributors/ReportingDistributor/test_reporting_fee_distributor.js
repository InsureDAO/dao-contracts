const { expect } = require("chai");
const { ethers } = require("hardhat");
const { BigNumber } = require("ethers");

async function snapshot() {
  return network.provider.send("evm_snapshot", []);
}

async function restore(snapshotId) {
  return network.provider.send("evm_revert", [snapshotId]);
}

describe("ReportingFeeDistributorV1", () => {
  const name = "Fee Token";
  const symbol = "FT";
  const decimal = 18;
  const rpt_decimal = 0;

  const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
  const FEE = BigNumber.from("1000000");

  before(async () => {
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

  beforeEach(async () => {
    snapshotId = await snapshot();
  });

  afterEach(async () => {
    await restore(snapshotId);
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

  describe("test_register", function () {
    it("register successfull", async () => {
      //add RPT member
      await rpt_token._mint_for_testing(1);

      //register
      await dstr.register_reporter(creator.address);

      expect(await dstr.reporters_length()).to.equal(1);
      expect(await dstr.reporters(1)).to.equal(creator.address);
      expect(await dstr.has_registered(creator.address)).to.equal(true);
      expect(await dstr.is_kicked(creator.address)).to.equal(false);
      expect(await dstr.active_reporter()).to.equal(1);
    });

    it("revert zero address", async () => {
      //add RPT member
      await rpt_token._mint_for_testing(1);

      //register
      await expect(dstr.register_reporter(ZERO_ADDRESS)).to.revertedWith("zero address");
    });

    it("not added if not rpt member", async () => {
      //register
      await dstr.register_reporter(creator.address);

      expect(await dstr.reporters_length()).to.equal(0);
      expect(await dstr.reporters(1)).to.equal(ZERO_ADDRESS);
      expect(await dstr.has_registered(creator.address)).to.equal(false);
      expect(await dstr.is_kicked(creator.address)).to.equal(false);
      expect(await dstr.active_reporter()).to.equal(0);
    });

    it("revert already registered", async () => {
      //add RPT member
      await rpt_token._mint_for_testing(1);

      //register
      await dstr.register_reporter(creator.address);
      await expect(dstr.register_reporter(creator.address)).to.revertedWith("already registere");
    });
  });

  describe("test_update_reporter", function () {
    it("registered, rpt member", async () => {
      //add RPT member
      await rpt_token._mint_for_testing(1);

      //register
      await dstr.register_reporter(creator.address);

      //update
      let tx = await dstr.update_reporter(creator.address);
      let receipt = await tx.wait();

      expect(receipt.events[0]["args"]["is_rpt"]).to.equal(true);
      expect(await dstr.reporters_length()).to.equal(1);
      expect(await dstr.reporters(1)).to.equal(creator.address);
      expect(await dstr.has_registered(creator.address)).to.equal(true);
      expect(await dstr.is_kicked(creator.address)).to.equal(false);
      expect(await dstr.active_reporter()).to.equal(1);
    });

    it("registered, not rpt member", async () => {
      //add RPT member
      await rpt_token._mint_for_testing(1);

      //register
      await dstr.register_reporter(creator.address);

      //kick
      await rpt_token.burn(1);

      //update
      let tx = await dstr.update_reporter(creator.address);
      let receipt = await tx.wait();

      expect(receipt.events[0]["args"]["is_rpt"]).to.equal(false);
      expect(await dstr.reporters_length()).to.equal(1);
      expect(await dstr.reporters(1)).to.equal(creator.address);
      expect(await dstr.has_registered(creator.address)).to.equal(true);
      expect(await dstr.is_kicked(creator.address)).to.equal(true);
      expect(await dstr.active_reporter()).to.equal(0);
    });

    it("registered, not rptmember => rpt member", async () => {
      //add RPT member
      await rpt_token._mint_for_testing(1);

      //register
      await dstr.register_reporter(creator.address);

      //kick
      await rpt_token.burn(1);

      //update
      let tx = await dstr.update_reporter(creator.address);
      let receipt = await tx.wait();

      expect(receipt.events[0]["args"]["is_rpt"]).to.equal(false);
      expect(await dstr.reporters_length()).to.equal(1);
      expect(await dstr.reporters(1)).to.equal(creator.address);
      expect(await dstr.has_registered(creator.address)).to.equal(true);
      expect(await dstr.is_kicked(creator.address)).to.equal(true);
      expect(await dstr.active_reporter()).to.equal(0);

      //add RPT member
      await rpt_token._mint_for_testing(1);

      //update
      tx = await dstr.update_reporter(creator.address);
      receipt = await tx.wait();

      expect(receipt.events[0]["args"]["is_rpt"]).to.equal(true);
      expect(await dstr.reporters_length()).to.equal(1);
      expect(await dstr.reporters_length()).to.equal(1);
      expect(await dstr.reporters(1)).to.equal(creator.address);
      expect(await dstr.has_registered(creator.address)).to.equal(true);
      expect(await dstr.is_kicked(creator.address)).to.equal(false);
      expect(await dstr.active_reporter()).to.equal(1);
    });

    it("registered, rpt member => not rpt member", async () => {
      //add RPT member
      await rpt_token._mint_for_testing(1);

      //register
      await dstr.register_reporter(creator.address);

      //update
      let tx = await dstr.update_reporter(creator.address);
      let receipt = await tx.wait();

      expect(receipt.events[0]["args"]["is_rpt"]).to.equal(true);
      expect(await dstr.reporters_length()).to.equal(1);
      expect(await dstr.reporters(1)).to.equal(creator.address);
      expect(await dstr.has_registered(creator.address)).to.equal(true);
      expect(await dstr.is_kicked(creator.address)).to.equal(false);
      expect(await dstr.active_reporter()).to.equal(1);

      //kick
      await rpt_token.burn(1);

      //update
      tx = await dstr.update_reporter(creator.address);
      receipt = await tx.wait();

      expect(receipt.events[0]["args"]["is_rpt"]).to.equal(false);
      expect(await dstr.reporters_length()).to.equal(1);
      expect(await dstr.reporters(1)).to.equal(creator.address);
      expect(await dstr.has_registered(creator.address)).to.equal(true);
      expect(await dstr.is_kicked(creator.address)).to.equal(true);
      expect(await dstr.active_reporter()).to.equal(0);
    });

    it("not registered", async () => {
      //add RPT member
      await rpt_token._mint_for_testing(1);

      //update
      let tx = await dstr.update_reporter(creator.address);
      let receipt = await tx.wait();

      expect(receipt.events[0]["args"]["is_rpt"]).to.equal(false);
      expect(await dstr.reporters_length()).to.equal(0);
      expect(await dstr.reporters(1)).to.equal(ZERO_ADDRESS);
      expect(await dstr.has_registered(creator.address)).to.equal(false);
      expect(await dstr.is_kicked(creator.address)).to.equal(false);
      expect(await dstr.active_reporter()).to.equal(0);
    });

    it("revert if killed", async () => {
      //add RPT member
      await rpt_token._mint_for_testing(1);

      //kill contract
      await dstr.kill_me();

      //update
      await expect(dstr.update_reporter(creator.address)).to.revertedWith("dev: contract is killed");
    });

    it("revert if zero address", async () => {
      //update
      await expect(dstr.update_reporter(ZERO_ADDRESS)).to.revertedWith("zero address");
    });
  });

  describe("test_update_reporter_many", function () {
    it("break; correctlly", async () => {
      //add RPT member
      await rpt_token._mint_for_testing(1);
      await rpt_token.connect(alice)._mint_for_testing(1);

      //register
      await dstr.register_reporter(creator.address);
      await dstr.register_reporter(alice.address);

      let addresses = [creator.address, alice.address];
      for (i = addresses.length; i < 20; i++) {
        addresses.push(ZERO_ADDRESS);
      }

      //update
      await dstr.update_reporter_many(addresses);

      //if break; doesn't work correctly, _update_reporter() will fail with ZERO_ADDRESS;
    });

    it("revert if killed", async () => {
      //add RPT member
      await rpt_token._mint_for_testing(1);
      await rpt_token.connect(alice)._mint_for_testing(1);

      //register
      await dstr.register_reporter(creator.address);
      await dstr.register_reporter(alice.address);

      let addresses = [creator.address, alice.address];
      for (i = addresses.length; i < 20; i++) {
        addresses.push(ZERO_ADDRESS);
      }

      //kill contract
      await dstr.kill_me();

      //update
      await expect(dstr.update_reporter_many(addresses)).to.revertedWith("dev: contract is killed");
    });
  });

  describe("test_distribute", function () {
    it("distribute correctlly", async () => {
      //add RPT member
      await rpt_token._mint_for_testing(1);

      //register
      await dstr.register_reporter(creator.address);

      //mint fee and approve to dstr
      //use bob as Fee container
      await fee.connect(bob)._mint_for_testing(FEE);
      await fee.connect(bob).approve(dstr.address, FEE);

      await dstr.connect(bob).distribute(fee.address);

      expect(await dstr.claimable_fee(creator.address)).to.equal(FEE);
      expect(await dstr.fee_total()).to.equal(0);
      expect(await dstr.bonus_total()).to.equal(0);
    });

    it("distribute multiple correctlly", async () => {
      //add RPT member
      await rpt_token._mint_for_testing(1);
      await rpt_token.connect(alice)._mint_for_testing(1);

      //register
      await dstr.register_reporter(creator.address);
      await dstr.register_reporter(alice.address);

      //mint fee and approve to dstr
      //use bob as Fee container
      await fee.connect(bob)._mint_for_testing(FEE);
      await fee.connect(bob).approve(dstr.address, FEE);

      await dstr.connect(bob).distribute(fee.address);

      expect(await dstr.claimable_fee(creator.address)).to.equal(FEE.div(2));
      expect(await dstr.claimable_fee(alice.address)).to.equal(FEE.div(2));

      let total_distributed = BigNumber.from("0");
      for (i = 0; i < addresses.length; i++) {
        total_distributed = total_distributed.add(await dstr.claimable_fee(addresses[i]));
      }
      let expected = (await fee.balanceOf(dstr.address)).sub(total_distributed);

      expect(await dstr.fee_total()).to.equal(expected);
      expect(await dstr.bonus_total()).to.equal(0);
    });

    it("distribute multiple correctlly", async () => {
      //add RPT member
      await rpt_token._mint_for_testing(1);
      await rpt_token.connect(alice)._mint_for_testing(1);
      await rpt_token.connect(chad)._mint_for_testing(1);

      //register
      await dstr.register_reporter(creator.address);
      await dstr.register_reporter(alice.address);
      await dstr.register_reporter(chad.address);

      //mint fee and approve to dstr
      //use bob as Fee container
      await fee.connect(bob)._mint_for_testing(FEE);
      await fee.connect(bob).approve(dstr.address, FEE);

      await dstr.connect(bob).distribute(fee.address);

      expect(await dstr.claimable_fee(creator.address)).to.equal(FEE.div("3"));
      expect(await dstr.claimable_fee(alice.address)).to.equal(FEE.div("3"));
      expect(await dstr.claimable_fee(chad.address)).to.equal(FEE.div("3"));

      let total_distributed = BigNumber.from("0");
      for (i = 0; i < addresses.length; i++) {
        total_distributed = total_distributed.add(await dstr.claimable_fee(addresses[i]));
      }
      let expected = (await fee.balanceOf(dstr.address)).sub(total_distributed);

      expect(await dstr.fee_total()).to.equal(expected);
      expect(await dstr.bonus_total()).to.equal(0);
    });
    //distribute twice
    it("distribute multiple twice correctlly", async () => {
      //add RPT member
      await rpt_token._mint_for_testing(1);
      await rpt_token.connect(alice)._mint_for_testing(1);
      await rpt_token.connect(chad)._mint_for_testing(1);

      //register
      await dstr.register_reporter(creator.address);
      await dstr.register_reporter(alice.address);
      await dstr.register_reporter(chad.address);

      //1
      await fee.connect(bob)._mint_for_testing(FEE);
      await fee.connect(bob).approve(dstr.address, FEE);

      await dstr.connect(bob).distribute(fee.address);

      let total_distributed = BigNumber.from("0");
      for (i = 0; i < addresses.length; i++) {
        total_distributed = total_distributed.add(await dstr.claimable_fee(addresses[i]));
      }
      let expected = (await fee.balanceOf(dstr.address)).sub(total_distributed);
      expect(await dstr.fee_total()).to.equal(expected);

      //2
      await fee.connect(bob)._mint_for_testing(FEE);
      await fee.connect(bob).approve(dstr.address, FEE);

      await dstr.connect(bob).distribute(fee.address);

      total_distributed = BigNumber.from("0");
      for (i = 0; i < addresses.length; i++) {
        total_distributed = total_distributed.add(await dstr.claimable_fee(addresses[i]));
      }
      expected = (await fee.balanceOf(dstr.address)).sub(total_distributed);
      expect(await dstr.fee_total()).to.equal(expected);
    });

    //distribute include kicked
    it("distribute multiple correctlly", async () => {
      //add RPT member
      await rpt_token._mint_for_testing(1);
      await rpt_token.connect(alice)._mint_for_testing(1);
      await rpt_token.connect(chad)._mint_for_testing(1);

      //register
      await dstr.register_reporter(creator.address);
      await dstr.register_reporter(alice.address);
      await dstr.register_reporter(chad.address);

      //mint fee and approve to dstr
      //use bob as Fee container
      await fee.connect(bob)._mint_for_testing(FEE);
      await fee.connect(bob).approve(dstr.address, FEE);

      //kick
      await rpt_token.connect(alice).burn(1);

      await dstr.connect(bob).distribute(fee.address);

      expect(await dstr.claimable_fee(creator.address)).to.equal(FEE.div("2")); //divided by the number of active_member
      expect(await dstr.claimable_fee(alice.address)).to.equal(0);
      expect(await dstr.claimable_fee(chad.address)).to.equal(FEE.div("2"));

      //check if bonus_total & dee_total tracks the number correctlly
      let total_distributed = BigNumber.from("0");
      for (i = 0; i < addresses.length; i++) {
        total_distributed = total_distributed.add(await dstr.claimable_fee(addresses[i]));
      }
      let expected = (await fee.balanceOf(dstr.address)).sub(total_distributed);

      expect(await dstr.fee_total()).to.equal(expected);
      expect(await dstr.bonus_total()).to.equal(0);
    });

    it("revert if killed", async () => {
      await dstr.kill_me();
      await expect(dstr.distribute(fee.address)).to.revertedWith("dev: contract is killed");
    });

    it("revert if token is wrong", async () => {
      await expect(dstr.distribute(rpt_token.address)).to.revertedWith("cannnot distribute this token");
    });
  });

  describe("test_bonus_distribute", function () {
    it("bonus distribute correctlly", async () => {
      //prep
      let ids = [1];
      let allocations = [100];

      for (i = ids.length; i < 100; i++) {
        ids.push(0);
        allocations.push(0);
      }

      //add RPT member
      await rpt_token._mint_for_testing(1);
      await rpt_token.connect(alice)._mint_for_testing(1);

      //register
      await dstr.register_reporter(creator.address);
      await dstr.register_reporter(alice.address);

      //mint fee and approve to dstr
      await fee.connect(bob)._mint_for_testing(FEE);
      await fee.connect(bob).approve(dstr.address, FEE);

      //set bonus_ratio
      await dstr.set_bonus_ratio(100); //100%

      //distribute
      await dstr.connect(bob).distribute(fee.address);

      expect(await dstr.fee_total()).to.equal(0);
      expect(await dstr.bonus_total()).to.equal(FEE);
      expect(await dstr.reporters(1)).to.equal(creator.address);
      expect(await dstr.reporters(2)).to.equal(alice.address);

      //bonus distribtution
      await dstr.bonus_distribution(ids, allocations);

      let total_distributed = BigNumber.from("0");
      for (i = 0; i < addresses.length; i++) {
        total_distributed = total_distributed.add(await dstr.claimable_fee(addresses[i]));
      }
      let expected = (await fee.balanceOf(dstr.address)).sub(total_distributed);

      expect(await dstr.bonus_total()).to.equal(expected);
      expect(await dstr.fee_total()).to.equal(0);
    });

    it("bonus distribute multiple correctlly", async () => {
      //prep
      let ids = [1, 2];
      let allocations = [100, 157];

      for (i = ids.length; i < 100; i++) {
        ids.push(0);
        allocations.push(0);
      }

      //add RPT member
      await rpt_token._mint_for_testing(1);
      await rpt_token.connect(alice)._mint_for_testing(1);

      //register
      await dstr.register_reporter(creator.address);
      await dstr.register_reporter(alice.address);

      //mint fee and approve to dstr
      await fee.connect(bob)._mint_for_testing(FEE);
      await fee.connect(bob).approve(dstr.address, FEE);

      //set bonus_ratio
      await dstr.set_bonus_ratio(100); //100%

      //distribute
      await dstr.connect(bob).distribute(fee.address);

      expect(await dstr.fee_total()).to.equal(0);
      expect(await dstr.bonus_total()).to.equal(FEE);
      expect(await dstr.reporters(1)).to.equal(creator.address);
      expect(await dstr.reporters(2)).to.equal(alice.address);

      //bonus distribtution
      await dstr.bonus_distribution(ids, allocations);

      let total_distributed = BigNumber.from("0");
      for (i = 0; i < addresses.length; i++) {
        total_distributed = total_distributed.add(await dstr.claimable_fee(addresses[i]));
      }
      let expected = (await fee.balanceOf(dstr.address)).sub(total_distributed);

      expect(await dstr.bonus_total()).to.equal(expected);
      expect(await dstr.fee_total()).to.equal(0);
    });

    it("bonus distribute multiple correctlly part2", async () => {
      //prep
      let ids = [1, 2, 1];
      let allocations = [100, 157, 500];

      for (i = ids.length; i < 100; i++) {
        ids.push(0);
        allocations.push(0);
      }

      //add RPT member
      await rpt_token._mint_for_testing(1);
      await rpt_token.connect(alice)._mint_for_testing(1);

      //register
      await dstr.register_reporter(creator.address);
      await dstr.register_reporter(alice.address);

      //mint fee and approve to dstr
      await fee.connect(bob)._mint_for_testing(FEE);
      await fee.connect(bob).approve(dstr.address, FEE);

      //set bonus_ratio
      await dstr.set_bonus_ratio(100); //100%

      //distribute
      await dstr.connect(bob).distribute(fee.address);

      expect(await dstr.fee_total()).to.equal(0);
      expect(await dstr.bonus_total()).to.equal(FEE);
      expect(await dstr.reporters(1)).to.equal(creator.address);
      expect(await dstr.reporters(2)).to.equal(alice.address);

      //bonus distribtution
      await dstr.bonus_distribution(ids, allocations);

      expect(await dstr.claimable_fee(creator.address)).to.equal(FEE.mul(100).div(757).add(FEE.mul(500).div(757))); //100+157+500
      expect(await dstr.claimable_fee(alice.address)).to.equal(FEE.mul(157).div(757)); //100+157+500

      let total_distributed = BigNumber.from("0");
      for (i = 0; i < addresses.length; i++) {
        total_distributed = total_distributed.add(await dstr.claimable_fee(addresses[i]));
      }
      let expected = (await fee.balanceOf(dstr.address)).sub(total_distributed);

      expect(await dstr.bonus_total()).to.equal(expected);
      expect(await dstr.fee_total()).to.equal(0);
    });

    it("revert if not admin", async () => {
      //prep
      let ids = [1, 2, 1];
      let allocations = [100, 157, 500];

      for (i = ids.length; i < 100; i++) {
        ids.push(0);
        allocations.push(0);
      }

      await expect(dstr.connect(alice).bonus_distribution(ids, allocations)).to.revertedWith(
        "Caller is not allowed to operate"
      );
    });
  });

  describe("test_claim", function () {
    it("claim successflly", async () => {
      //distribute
      await rpt_token._mint_for_testing(1);
      await dstr.register_reporter(creator.address);

      await fee.connect(bob)._mint_for_testing(FEE);
      await fee.connect(bob).approve(dstr.address, FEE);

      await dstr.connect(bob).distribute(fee.address);

      expect(await fee.balanceOf(creator.address)).to.equal(0);
      expect(await dstr.claimable_fee(creator.address)).to.equal(FEE);

      //claim
      await dstr.claim();

      expect(await fee.balanceOf(creator.address)).to.equal(FEE);
      expect(await dstr.claimable_fee(creator.address)).to.equal(0);
    });

    it("revert claim", async () => {
      await expect(dstr.claim()).to.revertedWith("no claimable fee");
    });
  });

  describe("test_config", function () {
    //set_bonus_ratio
    it("set bonus correctly", async () => {
      expect(await dstr.bonus_ratio()).to.equal(0);
      expect(await dstr.bonus_ratio_divider()).to.equal(100);

      await dstr.set_bonus_ratio(100);

      expect(await dstr.bonus_ratio()).to.equal(100);
      expect(await dstr.bonus_ratio_divider()).to.equal(100);
    });
    it("revert set bonus", async () => {
      await expect(dstr.connect(alice).set_bonus_ratio(100)).to.revertedWith("Caller is not allowed to operate");
      await expect(dstr.set_bonus_ratio(101)).to.revertedWith("exceed max");
    });

    //kill_me
    it("kill_me successfully", async () => {
      expect(await dstr.is_killed()).to.equal(false);
      await dstr.kill_me();
      expect(await dstr.is_killed()).to.equal(true);

      await dstr.kill_me();
      expect(await dstr.is_killed()).to.equal(true);
    });

    it("revert kill_me", async () => {
      await expect(dstr.connect(alice).kill_me()).to.revertedWith("Caller is not allowed to operate");

      await dstr.change_recovery(ZERO_ADDRESS);
      await expect(dstr.kill_me()).to.revertedWith("dev: recovery address is ZERO_ADDRESS");
    });

    //recovery
    it("recover successfully", async () => {
      await fee.connect(bob)._mint_for_testing(1000);
      await fee.connect(bob).transfer(dstr.address, 1000);

      expect(await fee.balanceOf(dstr.address)).to.equal(1000);

      //kill
      await dstr.kill_me();

      //recover
      await dstr.recover_balance(fee.address);

      expect(await fee.balanceOf(dstr.address)).to.equal(0);
      expect(await fee.balanceOf(alice.address)).to.equal(1000);
    });

    it("revert recover", async () => {
      await expect(dstr.connect(alice).recover_balance(fee.address)).to.revertedWith(
        "Caller is not allowed to operate"
      );
      await expect(dstr.recover_balance(fee.address)).to.revertedWith("dev: not killed");

      await dstr.change_recovery(ZERO_ADDRESS);
      await expect(dstr.recover_balance(fee.address)).to.revertedWith("recovery to ZERO_ADDRESS");
    });
  });
});
