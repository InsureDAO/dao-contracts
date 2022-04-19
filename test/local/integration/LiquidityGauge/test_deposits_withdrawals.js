const { expect } = require("chai");
const { ethers } = require("hardhat");
const { BigNumber } = require("ethers");

async function snapshot() {
  return network.provider.send("evm_snapshot", []);
}

async function restore(snapshotId) {
  return network.provider.send("evm_revert", [snapshotId]);
}

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

  let st_account;
  let st_value = BigNumber.from("0");
  let st_time = BigNumber.from("0");

  let balances = {};
  let balance = BigNumber.from("0");
  let accounts;

  //--------------------------------------------- functions -----------------------------------------------------------//

  function rdm_value(a) {
    let rdm = BigNumber.from(Math.floor(Math.random() * a).toString());
    return rdm;
  }

  //--------------------------------------------- randomly excuted functions -----------------------------------------------------------//
  async function rule_deposite() {
    console.log("rule_deposite");
    st_value = rdm_value(9007199254740991);
    balance = await mock_lp_token.balanceOf(st_account.address);

    //rdm = Math.floor(Math.random()*9007199254740991);
    //st_value = BigNumber.from(rdm.toString());

    await liquidity_gauge.connect(st_account).deposit(st_value, st_account.address);
    balances[st_account.address] = balances[st_account.address].add(st_value);

    expect(await mock_lp_token.balanceOf(st_account.address)).to.equal(balance.sub(st_value));
    expect(await liquidity_gauge.balanceOf(st_account.address)).to.equal(balances[st_account.address]);
  }

  async function rule_withdraw() {
    console.log("rule_withdraw");
    st_value = rdm_value(9007199254740991);

    if (balances[st_account.address].lt(st_value)) {
      await expect(liquidity_gauge.connect(st_account).withdraw(st_value)).to.reverted;
      console.log("-withdraw revert");
      return;
    }

    balance = await mock_lp_token.balanceOf(st_account.address);
    await liquidity_gauge.connect(st_account).withdraw(st_value);
    balances[st_account.address] = balances[st_account.address].sub(st_value);

    expect(await mock_lp_token.balanceOf(st_account.address)).to.equal(balance.add(st_value));
    expect(await liquidity_gauge.balanceOf(st_account.address)).to.equal(balances[st_account.address]);
  }

  async function rule_advance_time() {
    console.log("rule_advance_time");
    st_time = rdm_value(86400 * 365);
    await ethers.provider.send("evm_increaseTime", [st_time.toNumber()]);
    await ethers.provider.send("evm_mine");
  }

  async function rule_checkpoint() {
    console.log("rule_checkpoint");

    await liquidity_gauge.connect(st_account).user_checkpoint(st_account.address);
  }

  //-------------------------------------------- function array -----------------------------------------------------------//
  let func = ["rule_deposite", "rule_withdraw", "rule_advance_time", "rule_checkpoint"];

  //------------------------------------------------- run tests ------------------------------------------------------------------------//

  beforeEach(async () => {
    console.log("before each");

    //import
    [creator, alice, bob, chad, dad, eme, fangible, gg, nine, ten] = await ethers.getSigners();
    accounts = [creator, alice, bob, chad, dad, eme, fangible, gg, nine, ten];

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
    mock_lp_token = await TestLP.deploy("InsureDAO LP token", "indexSURE", decimal, ten_to_the_21); //Not using the actual InsureDAO contract

    minter = await Minter.deploy(Insure.address, gauge_controller.address, ownership.address);
    liquidity_gauge = await LiquidityGauge.deploy(mock_lp_token.address, minter.address, ownership.address);

    let rdm = Math.floor(Math.random() * 5); //0~4 integer
    st_account = accounts[rdm];

    for (let i = 1; i < 5; i++) {
      await mock_lp_token.transfer(accounts[i].address, ten_to_the_20);
    }

    for (let i = 0; i < 5; i++) {
      await mock_lp_token.connect(accounts[i]).approve(liquidity_gauge.address, ten_to_the_21);
    }

    for (let i = 0; i < 10; i++) {
      balances[accounts[i].address] = BigNumber.from("0");
    }

    console.log(balances);

    balance = BigNumber.from("0");
  });

  afterEach(async () => {
    //--- invariant_balances ---//
    console.log("after each");
    for (let i = 0; i < 10; i++) {
      console.log(await liquidity_gauge.balanceOf(accounts[i].address));
      console.log(balances[accounts[i].address]);
      console.log("-----------------");
      expect(await liquidity_gauge.balanceOf(accounts[i].address)).to.equal(balances[accounts[i].address]);
    }

    //--- invariant_total_supply ---//
    let total = BigNumber.from("0");
    for (let i = 0; i < 10; i++) {
      console.log(balances[accounts[i].address]);
      total = total.add(balances[accounts[i].address]);
    }
    expect(await liquidity_gauge.totalSupply()).to.equal(total); //
  });

  describe("test_deposits_withdrawals", function () {
    for (let x = 0; x < 5; x++) {
      it("try " + eval("x+1"), async () => {
        for (let i = 0; i < 5; i++) {
          let n = await rdm_value(4);
          await eval(func[n])();
        }
      });
    }
  });
});
