const { expect } = require("chai");
const { ethers } = require("hardhat");
const { BigNumber } = require("ethers");

describe("LiquidityGauge", function () {
  const YEAR = BigNumber.from(86400 * 365);
  const WEEK = BigNumber.from(86400 * 7);

  const name = "InsureToken";
  const symbol = "Insure";
  const decimal = 18;

  const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

  const two_to_the_256_minus_1 = BigNumber.from("2").pow(BigNumber.from("256")).sub(BigNumber.from("1"));
  const ten_to_the_21 = BigNumber.from("1000000000000000000000");
  const ten_to_the_20 = BigNumber.from("100000000000000000000");
  const ten_to_the_19 = BigNumber.from("10000000000000000000");
  const ten_to_the_18 = BigNumber.from("1000000000000000000");
  const ten_to_the_17 = BigNumber.from("100000000000000000");
  const ten_to_the_9 = BigNumber.from("1000000000");
  const zero = BigNumber.from("0");
  const MAX_UINT256 = BigNumber.from("115792089237316195423570985008687907853269984665640564039457584007913129639935");

  beforeEach(async () => {
    console.log("before each");

    //import
    [alice, bob] = await ethers.getSigners();

    const Ownership = await ethers.getContractFactory("Ownership");
    const Token = await ethers.getContractFactory("InsureToken");
    const VotingEscrow = await ethers.getContractFactory("VotingEscrow");
    const GaugeController = await ethers.getContractFactory("GaugeController");
    const LiquidityGauge = await ethers.getContractFactory("LiquidityGauge");
    const TestLP = await ethers.getContractFactory("TestLP");
    const Minter = await ethers.getContractFactory("Minter");
    const Registry = await ethers.getContractFactory("TestRegistry");

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
    mock_lp_token = await TestLP.deploy("InsureDAO LP token", "indexSURE", decimal, ten_to_the_21.mul("2")); //Not using the actual InsureDAO contract
    minter = await Minter.deploy(Insure.address, gauge_controller.address, ownership.address);
    liquidity_gauge = await LiquidityGauge.deploy(mock_lp_token.address, minter.address, ownership.address);
  });

  describe("test_liquidity_gauge", function () {
    it("test_gauge_integral", async () => {
      let alice_staked = BigNumber.from("0");
      let bob_staked = BigNumber.from("0");
      let integral = BigNumber.from("0");
      let checkpoint = BigNumber.from((await ethers.provider.getBlock("latest")).timestamp);
      let checkpoint_rate = await Insure.rate();
      let checkpoint_supply = BigNumber.from("0");
      let checkpoint_balance = BigNumber.from("0");

      await gauge_controller.add_type("Liquidity", BigNumber.from("0"));
      await gauge_controller.change_type_weight(1, ten_to_the_18);
      await gauge_controller.add_gauge(liquidity_gauge.address, 1, ten_to_the_18);

      await mock_lp_token.transfer(
        bob.address,
        (await mock_lp_token.balanceOf(alice.address)).div(BigNumber.from("2"))
      );

      async function update_integral() {
        let t1 = BigNumber.from((await ethers.provider.getBlock("latest")).timestamp);
        let rate1 = await Insure.rate();
        let t_epoch = await Insure.start_epoch_time();
        let rate_x_time = BigNumber.from("0");

        if (checkpoint.gte(t_epoch)) {
          rate_x_time = t1.sub(checkpoint).mul(rate1);
        } else {
          rate_x_time = t_epoch.sub(checkpoint).mul(checkpoint_rate).add(t1.sub(t_epoch).mul(rate1));
        }

        if (checkpoint_supply.gt(BigNumber.from("0"))) {
          integral = integral.add(rate_x_time.mul(checkpoint_balance).div(checkpoint_supply));
        }

        checkpoint_rate = rate1;
        checkpoint = t1;
        checkpoint_supply = await liquidity_gauge.totalSupply();
        checkpoint_balance = await liquidity_gauge.balanceOf(alice.address);
      }

      // Now let's have a loop where Bob always deposit or withdraws,
      // and Alice does so more rarely
      for (let i = 0; i < 10; i++) {
        let is_alice = Math.random() < 0.2;
        let dt = BigNumber.from(Math.floor(Math.random() * 86400 * 73).toString()).add(BigNumber.from("1"));

        await ethers.provider.send("evm_increaseTime", [dt.toNumber()]);

        // For Bob
        let is_withdraw = i > 0 && Math.random() < 0.5; //(i > 0) * (random() < 0.5)

        if (is_withdraw) {
          //withdraw
          let amount = BigNumber.from(Math.floor(Math.random() * 10000).toString())
            .mul(await liquidity_gauge.balanceOf(bob.address))
            .div(BigNumber.from("10000"));
          console.log("Bob Withdraws " + amount.div(BigNumber.from("10").pow("18")).toNumber());
          await liquidity_gauge.connect(bob).withdraw(amount);
          await update_integral();
          bob_staked = bob_staked.sub(amount);
          console.log("--------------------> bob:" + bob_staked.div(BigNumber.from("10").pow("18")).toNumber());
        } else {
          //deposit
          let amount = BigNumber.from(Math.floor(Math.random() * 10000).toString())
            .mul(await mock_lp_token.balanceOf(bob.address))
            .div(BigNumber.from("10"))
            .div(BigNumber.from("10000"));
          console.log("Bob Deposits " + amount.div(BigNumber.from("10").pow("18")).toNumber());
          await mock_lp_token.connect(bob).approve(liquidity_gauge.address, amount);
          await liquidity_gauge.connect(bob).deposit(amount, bob.address);
          await update_integral();
          bob_staked = bob_staked.add(amount);
          console.log("--------------------> bob:" + bob_staked.div(BigNumber.from("10").pow("18")).toNumber());
        }

        if (is_alice) {
          //For Alice
          let is_withdraw_alice = (await liquidity_gauge.balanceOf(alice.address)) > 0 && Math.random() > 0.5;
          if (is_withdraw_alice) {
            console.log("Alice Withdraws");
            let amount_alice = BigNumber.from(Math.floor(Math.random() * 10000).toString())
              .mul(await liquidity_gauge.balanceOf(alice.address))
              .div(BigNumber.from("10"))
              .div(BigNumber.from("10000"));
            await liquidity_gauge.withdraw(amount_alice);
            await update_integral();
            alice_staked = alice_staked.sub(amount_alice);
          } else {
            console.log("Alice Deposits");
            let amount_alice = BigNumber.from(Math.floor(Math.random() * 10000).toString())
              .mul(await mock_lp_token.balanceOf(alice.address))
              .div(BigNumber.from("10000"));
            await mock_lp_token.approve(liquidity_gauge.address, amount_alice);
            await liquidity_gauge.deposit(amount_alice, alice.address);
            await update_integral();
            alice_staked = alice_staked.add(amount_alice);
          }
        }

        // Checking that updating the checkpoint in the same second does nothing
        // Also everyone can update: that should make no difference, too
        if (Math.random() < 0.5) {
          await liquidity_gauge.user_checkpoint(alice.address);
        }
        if (Math.random() < 0.5) {
          await liquidity_gauge.connect(bob).user_checkpoint(bob.address);
        }

        expect(await liquidity_gauge.balanceOf(alice.address)).to.equal(alice_staked);
        expect(await liquidity_gauge.balanceOf(bob.address)).to.equal(bob_staked);
        expect(await liquidity_gauge.totalSupply()).to.equal(alice_staked.add(bob_staked));

        dt = BigNumber.from(Math.floor(Math.random() * 86400 * 19).toString()).add(BigNumber.from("1"));

        await ethers.provider.send("evm_increaseTime", [dt.toNumber()]);

        await liquidity_gauge.user_checkpoint(alice.address);
        await update_integral();
        console.log(
          i + ":" + dt / 86400 + ":" + integral + ":" + (await liquidity_gauge.integrate_fraction(alice.address))
        ); //approx 1e-20
      }
    });

    it("test_mining_with_votelock", async () => {
      await ethers.provider.send("evm_increaseTime", [
        WEEK.mul(BigNumber.from("2")).add(BigNumber.from("5")).toNumber(),
      ]);

      // Wire up Gauge to the controller to have proper rates and stuff
      await gauge_controller.add_type("Liquidity", BigNumber.from("0"));
      await gauge_controller.change_type_weight(1, ten_to_the_18);
      await gauge_controller.add_gauge(liquidity_gauge.address, 1, ten_to_the_18);

      // Prepare tokens
      await Insure.transfer(bob.address, ten_to_the_20);
      await Insure.approve(voting_escrow.address, MAX_UINT256);
      await Insure.connect(bob).approve(voting_escrow.address, MAX_UINT256);
      await mock_lp_token.transfer(
        bob.address,
        (await mock_lp_token.balanceOf(alice.address)).div(BigNumber.from("2"))
      );
      await mock_lp_token.approve(liquidity_gauge.address, MAX_UINT256);
      await mock_lp_token.connect(bob).approve(liquidity_gauge.address, MAX_UINT256);

      // Alice deposits to escrow. She now has a BOOST
      let t = BigNumber.from((await ethers.provider.getBlock("latest")).timestamp);
      await voting_escrow.create_lock(ten_to_the_20, t.add(WEEK.mul(BigNumber.from("2"))));

      // Alice and Bob deposit some liquidity
      await liquidity_gauge.deposit(ten_to_the_21, alice.address);
      await liquidity_gauge.connect(bob).deposit(ten_to_the_21, bob.address);
      let now = BigNumber.from((await ethers.provider.getBlock("latest")).timestamp);
      //expect(await voting_escrow.balanceOf(alice.address, now)).to.not.equal(zero);
      //expect(await voting_escrow.balanceOf(bob.address, now)).to.equal(zero);
      expect(await voting_escrow["balanceOf(address,uint256)"](alice.address, now)).to.not.equal(zero);
      expect(await voting_escrow["balanceOf(address,uint256)"](bob.address, now)).to.equal(zero);

      // Time travel and checkpoint
      now = BigNumber.from((await ethers.provider.getBlock("latest")).timestamp);
      await ethers.provider.send("evm_setNextBlockTimestamp", [now.add(WEEK.mul(BigNumber.from("4"))).toNumber()]);

      //await alice.tranfer(alice, 1);
      await network.provider.send("evm_setAutomine", [false]);
      await liquidity_gauge.connect(bob).user_checkpoint(bob.address);
      await liquidity_gauge.user_checkpoint(alice.address);
      await network.provider.send("evm_mine");
      await network.provider.send("evm_setAutomine", [true]);

      // 4 weeks down the road, balanceOf must be 0
      now = BigNumber.from((await ethers.provider.getBlock("latest")).timestamp);
      expect(await voting_escrow["balanceOf(address,uint256)"](alice.address, now)).to.equal(zero);
      expect(await voting_escrow["balanceOf(address,uint256)"](bob.address, now)).to.equal(zero);

      // Alice earned 2.5 times more INSURE because she vote-locked her INSURE
      let rewards_alice = await liquidity_gauge.integrate_fraction(alice.address);
      let rewards_bob = await liquidity_gauge.integrate_fraction(bob.address);
      expect(rewards_alice.mul(BigNumber.from("10000000000000000")).div(rewards_bob)).to.equal(
        BigNumber.from("25000000000000000")
      ); //approx = 1e-16

      // Time travel / checkpoint: no one has INSURE vote-locked
      now = BigNumber.from((await ethers.provider.getBlock("latest")).timestamp);
      await ethers.provider.send("evm_setNextBlockTimestamp", [now.add(WEEK.mul(BigNumber.from("4"))).toNumber()]);

      await network.provider.send("evm_setAutomine", [false]);
      await liquidity_gauge.connect(bob).user_checkpoint(bob.address);
      await liquidity_gauge.user_checkpoint(alice.address);
      await network.provider.send("evm_mine");
      await network.provider.send("evm_setAutomine", [true]);

      let old_rewards_alice = rewards_alice;
      let old_rewards_bob = rewards_bob;

      //Alice earned the same as Bob now
      rewards_alice = await liquidity_gauge.integrate_fraction(alice.address);
      rewards_bob = await liquidity_gauge.integrate_fraction(bob.address);
      let d_alice = rewards_alice.sub(old_rewards_alice);
      let d_bob = rewards_bob.sub(old_rewards_bob);
      expect(d_alice.sub(d_bob)).to.equal(zero);
    });
  });
});
