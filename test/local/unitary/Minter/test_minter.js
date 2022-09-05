const { expect } = require("chai");
const { ethers } = require("hardhat");
const { BigNumber } = require("ethers");

async function snapshot() {
  return network.provider.send("evm_snapshot", []);
}

async function restore(snapshotId) {
  return network.provider.send("evm_revert", [snapshotId]);
}

describe("Minter", function () {
  const YEAR = BigNumber.from(86400 * 365);
  const MONTH = BigNumber.from(86400 * 30);
  const WEEK = BigNumber.from(86400 * 7);
  const DAY = BigNumber.from(86400);

  const name = "InsureToken";
  const symbol = "Insure";
  const decimal = 18;

  const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

  const MAX_UINT256 = BigNumber.from("115792089237316195423570985008687907853269984665640564039457584007913129639935");
  const two_to_the_256_minus_1 = BigNumber.from("2").pow(BigNumber.from("256")).sub(BigNumber.from("1"));
  const ten_to_the_21 = BigNumber.from("1000000000000000000000");
  const ten_to_the_20 = BigNumber.from("100000000000000000000");
  const ten_to_the_19 = BigNumber.from("10000000000000000000");
  const ten_to_the_18 = BigNumber.from("1000000000000000000");
  const ten_to_the_17 = BigNumber.from("100000000000000000");
  const ten_to_the_9 = BigNumber.from("1000000000");

  const a = BigNumber.from("5");
  const zero = BigNumber.from("0");

  const TYPE_WEIGHTS = [ten_to_the_17.mul(a), ten_to_the_19];
  const GAUGE_WEIGHTS = [ten_to_the_19, ten_to_the_18, ten_to_the_17.mul(a)];
  const GAUGE_TYPES = [1, 1, 2];

  before(async () => {
    //import
    [creator, alice, bob, charly] = await ethers.getSigners();
    const Ownership = await ethers.getContractFactory("Ownership");
    const Token = await ethers.getContractFactory("InsureToken");
    const VotingEscrow = await ethers.getContractFactory("VotingEscrow");
    const GaugeController = await ethers.getContractFactory("GaugeController");
    const LiquidityGauge = await ethers.getContractFactory("LiquidityGauge");
    const TestLP = await ethers.getContractFactory("TestLP");
    const Registry = await ethers.getContractFactory("TestRegistry");
    const Minter = await ethers.getContractFactory("Minter");

    //deploy
    ownership = await Ownership.deploy();
    Insure = await Token.deploy(name, symbol, ownership.address);
    voting_escrow = await VotingEscrow.deploy(
      Insure.address,
      "Voting-escrowed Insure",
      "veInsure",
      "veInsure",
      ownership.address
    );
    gauge_controller = await GaugeController.deploy(Insure.address, voting_escrow.address, ownership.address);

    mock_lp_token = await TestLP.deploy("InsureDAO LP token", "iToken", decimal, ten_to_the_21); //Not using the actual InsureDAO contract
    minter = await Minter.deploy(Insure.address, gauge_controller.address, ownership.address);

    lg1 = await LiquidityGauge.deploy(mock_lp_token.address, minter.address, ownership.address);
    lg2 = await LiquidityGauge.deploy(mock_lp_token.address, minter.address, ownership.address);
    lg3 = await LiquidityGauge.deploy(mock_lp_token.address, minter.address, ownership.address);

    three_gauges_contracts = [lg1, lg2, lg3];
    three_gauges = [lg1.address, lg2.address, lg3.address];

    //--------setup--------//
    await Insure.set_minter(minter.address);
    let accounts = [creator, alice, bob, charly];

    //add types
    for (let i = 0; i < 2; i++) {
      await gauge_controller.add_type("Liquidity", TYPE_WEIGHTS[i]);
    }

    //add gauges
    for (let i = 0; i < 3; i++) {
      await gauge_controller.add_gauge(three_gauges[i], GAUGE_TYPES[i], GAUGE_WEIGHTS[i]);
    }

    //token transfer
    for (let i = 1; i < 4; i++) {
      await mock_lp_token.transfer(accounts[i].address, ten_to_the_18);
    }

    //approve gauge
    for (let i = 0; i < 3; i++) {
      for (let t = 0; t < 3; t++) {
        await mock_lp_token.connect(accounts[i + 1]).approve(three_gauges[t], ten_to_the_18);
      }
    }
  });

  beforeEach(async () => {
    snapshotId = await snapshot();
  });

  afterEach(async () => {
    await restore(snapshotId);
  });

  describe("test_minter", function () {
    it("test_mint", async () => {
      await lg1.connect(alice).deposit(ten_to_the_17, alice.address);

      await ethers.provider.send("evm_increaseTime", [MONTH.toNumber()]);

      await minter.connect(alice).mint(three_gauges[0]); //gauge_address, msg.sender, mint
      let expected = await lg1.integrate_fraction(alice.address);

      expect(expected.gt(BigNumber.from("0"))).to.be.equal(true);
      expect(await Insure.balanceOf(alice.address)).to.equal(expected);
      expect(await minter.minted(alice.address, three_gauges[0])).to.equal(expected);
    });

    it("test_mint_immediate", async () => {
      //setup
      await three_gauges_contracts[0].connect(alice).deposit(ten_to_the_18, alice.address);

      let t0 = BigNumber.from((await ethers.provider.getBlock("latest")).timestamp);
      let moment = t0.add(WEEK).div(WEEK).mul(WEEK).add("5");
      await ethers.provider.send("evm_setNextBlockTimestamp", [moment.toNumber()]);

      //mint
      expect(await minter.minted(alice.address, three_gauges[0])).to.equal("0");
      await minter.connect(alice).mint(three_gauges[0]);

      //check
      let balance = await Insure.balanceOf(alice.address);
      expect(await minter.minted(alice.address, three_gauges[0])).to.equal(balance);
    });

    it("test_mint_multiple_same_gauge", async () => {
      await lg1.connect(alice).deposit(ten_to_the_18, alice.address);

      await ethers.provider.send("evm_increaseTime", [MONTH.toNumber()]);
      await minter.connect(alice).mint(three_gauges[0]);
      let balance = await Insure.balanceOf(alice.address);

      await ethers.provider.send("evm_increaseTime", [MONTH.toNumber()]);
      await minter.connect(alice).mint(three_gauges[0]);
      let expected = await lg1.integrate_fraction(alice.address);
      let final_balance = await Insure.balanceOf(alice.address);

      expect(final_balance.gt(balance)).to.be.equal(true); //2nd mint success
      expect(final_balance).to.equal(expected); //2nd mint works fine
      expect(await minter.minted(alice.address, three_gauges[0])).to.equal(expected); //tracks fine
    });

    it("test_mint_multiple_gauges", async () => {
      //setup
      await lg1.connect(alice).deposit(ten_to_the_17, alice.address);
      await lg2.connect(alice).deposit(ten_to_the_17, alice.address);
      await lg3.connect(alice).deposit(ten_to_the_17, alice.address);

      await ethers.provider.send("evm_increaseTime", [MONTH.toNumber()]);

      //mint
      for (let i = 0; i < 3; i++) {
        await minter.connect(alice).mint(three_gauges[i]);
      }

      //check
      let total_minted = BigNumber.from("0");

      for (let i = 0; i < 3; i++) {
        let gauge = three_gauges_contracts[i];
        let minted = await minter.minted(alice.address, gauge.address);
        expect(minted).to.equal(await gauge.integrate_fraction(alice.address));
        total_minted = total_minted.add(minted);
      }

      expect(await Insure.balanceOf(alice.address)).to.equal(total_minted);
    });

    it("test_mint_after_withdraw", async () => {
      await lg1.connect(alice).deposit(ten_to_the_18, alice.address);

      await ethers.provider.send("evm_increaseTime", [WEEK.mul(BigNumber.from("2")).toNumber()]);

      await lg1.connect(alice).withdraw(ten_to_the_18);
      await minter.connect(alice).mint(three_gauges[0]);

      expect((await Insure.balanceOf(alice.address)).gt(BigNumber.from("0"))).to.equal(true);
    });

    it("test_mint_multiple_after_withdraw", async () => {
      await lg1.connect(alice).deposit(ten_to_the_18, alice.address);

      await ethers.provider.send("evm_increaseTime", [10]);
      await lg1.connect(alice).withdraw(ten_to_the_18);
      await minter.connect(alice).mint(three_gauges[0]);

      let balance = await Insure.balanceOf(alice.address);

      await ethers.provider.send("evm_increaseTime", [10]);
      await minter.connect(alice).mint(three_gauges[0]);

      expect(await Insure.balanceOf(alice.address)).to.equal(balance);
    });

    it("test_no_deposit", async () => {
      await minter.connect(alice).mint(three_gauges[0]);
      expect(await Insure.balanceOf(alice.address)).to.equal(zero);
      expect(await minter.minted(alice.address, three_gauges[0])).to.equal(zero);
    });

    it("test_mint_wrong_gauge", async () => {
      await lg1.connect(alice).deposit(ten_to_the_18, alice.address);

      await ethers.provider.send("evm_increaseTime", [MONTH.toNumber()]);
      await minter.connect(alice).mint(three_gauges[1]);

      //check
      expect(await Insure.balanceOf(alice.address)).to.equal(zero);
      expect(await minter.minted(alice.address, three_gauges[0])).to.equal(zero);
      expect(await minter.minted(alice.address, three_gauges[1])).to.equal(zero);
    });

    it("test_mint_not_a_gauge", async () => {
      await expect(minter.mint(alice.address)).to.revertedWith("dev: gauge is not added");
    });

    it("test_mint_before_inflation_begins", async () => {
      await lg1.connect(alice).deposit(ten_to_the_18, alice.address);
      expect(await Insure.mining_epoch()).to.equal(BigNumber.from("-1"));

      await minter.connect(alice).mint(three_gauges[0]);
      expect(await Insure.balanceOf(alice.address)).to.equal(BigNumber.from("0"));
      expect(await minter.minted(alice.address, three_gauges[0])).to.equal(zero);
    });

    it("test_mint_many_multiple_gauges", async () => {
      //setup
      await lg1.connect(alice).deposit(ten_to_the_17, alice.address);
      await lg2.connect(alice).deposit(ten_to_the_17, alice.address);
      await lg3.connect(alice).deposit(ten_to_the_17, alice.address);

      await ethers.provider.send("evm_increaseTime", [MONTH.toNumber()]);

      let addresses = [
        lg1.address,
        lg2.address,
        lg3.address,
        ZERO_ADDRESS,
        ZERO_ADDRESS,
        ZERO_ADDRESS,
        ZERO_ADDRESS,
        ZERO_ADDRESS,
      ];
      await minter.connect(alice).mint_many(addresses);

      //check
      let total_minted = BigNumber.from("0");

      for (let i = 0; i < 3; i++) {
        let gauge = three_gauges_contracts[i];
        let minted = await minter.minted(alice.address, gauge.address);
        expect(minted).to.equal(await gauge.integrate_fraction(alice.address));
        total_minted = total_minted.add(minted);
      }

      expect(await Insure.balanceOf(alice.address)).to.equal(total_minted);
    });

    it("test_toggle_approve_mint", async () => {
      await minter.connect(alice).toggle_approve_mint(bob.address);
      expect(await minter.allowed_to_mint_for(bob.address, alice.address)).to.equal(true);

      await minter.connect(alice).toggle_approve_mint(bob.address);
      expect(await minter.allowed_to_mint_for(bob.address, alice.address)).to.equal(false);
    });

    it("test_mint_for", async () => {
      await lg1.connect(alice).deposit(ten_to_the_17, alice.address);

      await ethers.provider.send("evm_increaseTime", [MONTH.toNumber()]);

      await minter.connect(alice).toggle_approve_mint(bob.address);
      expect(await minter.allowed_to_mint_for(bob.address, alice.address)).to.equal(true);

      await minter.connect(bob).mint_for(lg1.address, alice.address);

      let expected = await lg1.integrate_fraction(alice.address);
      expect(expected.gt(BigNumber.from("0"))).to.be.equal(true);
      expect(await Insure.balanceOf(alice.address)).to.equal(expected);
      expect(await minter.minted(alice.address, three_gauges[0])).to.equal(expected);
    });

    it("test_mint_for_fail", async () => {
      await lg1.connect(alice).deposit(ten_to_the_17, alice.address);

      await ethers.provider.send("evm_increaseTime", [MONTH.toNumber()]);

      expect(await minter.allowed_to_mint_for(bob.address, alice.address)).to.equal(false);

      await minter.connect(bob).mint_for(lg1.address, alice.address);

      expect(await Insure.balanceOf(alice.address)).to.equal(0);
      expect(await minter.minted(alice.address, three_gauges[0])).to.equal(0);
    });
  });
});
