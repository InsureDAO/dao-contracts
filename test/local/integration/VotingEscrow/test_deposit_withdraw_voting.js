const { expect } = require("chai");
const { ethers } = require("hardhat");
const { BigNumber, ContractTransaction } = require("ethers");
const { iteratee } = require("underscore");

describe("VotingEscrow", function () {
  const YEAR = BigNumber.from(86400 * 365);
  const WEEK = BigNumber.from(86400 * 7);

  const name = "InsureToken";
  const symbol = "Insure";
  const decimal = 18;

  const MAX_TIME = YEAR.mul("4");
  const two_to_the_256_minus_1 = BigNumber.from("2").pow(BigNumber.from("256")).sub(BigNumber.from("1"));
  const ten_to_the_40 = BigNumber.from("10000000000000000000000000000000000000000");

  const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

  let accounts;
  let st_account_n;
  let st_account;
  let st_value = BigNumber.from("0");
  let st_time = BigNumber.from("0");
  let token_balances;
  let voting_balances;
  let unlock_time;
  let st_lock_duration;
  let tx;
  let receipt;

  beforeEach(async () => {
    //import
    [creator, alice, bob, chad, dad, elephant, fei, god, hecta, iloveyou] = await ethers.getSigners();
    accounts = [creator, alice, bob, chad, dad, elephant, fei, god, hecta, iloveyou];
    const Ownership = await ethers.getContractFactory("Ownership");
    const Token = await ethers.getContractFactory("TestToken");
    const VotingEscrow = await ethers.getContractFactory("VotingEscrow");
    const CollateralManager = await ethers.getContractFactory("TestCollateralManager");

    ownership = await Ownership.deploy();
    token = await Token.deploy(name, symbol, decimal);
    voting_escrow = await VotingEscrow.deploy(
      token.address,
      "Voting-escrowed Insure",
      "veInsure",
      "veInsure",
      ownership.address
    );
    manager = await CollateralManager.deploy(voting_escrow.address);

    //init
    for (i = 0; i < 10; i++) {
      await token.connect(accounts[i])._mint_for_testing(ten_to_the_40);
      await token.connect(accounts[i]).approve(voting_escrow.address, two_to_the_256_minus_1);
    }

    tx = await voting_escrow.commit_collateral_manager(manager.address);
    await tx.wait();
    await voting_escrow.apply_collateral_manager();

    console.log(manager.address);
    console.log(await voting_escrow.collateral_manager());

    //setup
    token_balances = [
      ten_to_the_40,
      ten_to_the_40,
      ten_to_the_40,
      ten_to_the_40,
      ten_to_the_40,
      ten_to_the_40,
      ten_to_the_40,
      ten_to_the_40,
      ten_to_the_40,
      ten_to_the_40,
    ];
    voting_balances = [];
    for (i = 0; i < 10; i++) {
      voting_balances.push({ value: BigNumber.from("0"), unlock_time: BigNumber.from("0") });
    }
  });

  //--------------------------------------------- functions -----------------------------------------------------------//

  function rdm_value(a) {
    let rdm = BigNumber.from(Math.floor(Math.random() * a).toString());
    return rdm;
  }

  //--------------------------------------------- randomly excuted functions -----------------------------------------------------------//
  async function rule_create_lock() {
    console.log("rule_create_lock");

    //st_account
    let rdm = Math.floor(Math.random() * 10); //0~9 integer
    st_account_n = rdm;
    st_account = accounts[st_account_n];

    //st_value
    st_value = rdm_value(9007199254740991);

    //number of weeks to lock a deposit
    st_lock_duration = rdm_value(255); //uint8.max

    let timestamp = BigNumber.from((await ethers.provider.getBlock("latest")).timestamp);
    unlock_time = timestamp.add(WEEK.mul(st_lock_duration)).div(WEEK).mul(WEEK);

    if (st_value == 0) {
      console.log("--revert: 1");
      await expect(voting_escrow.connect(st_account).create_lock(st_value, unlock_time)).to.revertedWith(
        "dev: need non-zero value"
      );
    } else if (voting_balances[st_account_n]["value"].gt("0")) {
      console.log("--revert: 2");
      await expect(voting_escrow.connect(st_account).create_lock(st_value, unlock_time)).to.revertedWith(
        "Withdraw old tokens first"
      );
    } else if (unlock_time.lte(timestamp)) {
      console.log("--revert: 3");
      await expect(voting_escrow.connect(st_account).create_lock(st_value, unlock_time)).to.revertedWith(
        "Can lock until time in future"
      );
    } else if (unlock_time.gte(timestamp.add(YEAR.mul("4")))) {
      console.log("--revert: 4");
      await expect(voting_escrow.connect(st_account).create_lock(st_value, unlock_time)).to.revertedWith(
        "Voting lock can be 4 years max"
      );
    } else {
      console.log("--success, account:", st_account_n);
      tx = await voting_escrow.connect(st_account).create_lock(st_value, unlock_time);
      receipt = await tx.wait();
      voting_balances[st_account_n] = { value: st_value, unlock_time: receipt.events[1]["args"]["locktime"] };
    }
  }

  async function rule_increase_amount() {
    console.log("rule_increase_amount");

    //st_account
    let rdm = Math.floor(Math.random() * 10); //0~9 integer
    st_account_n = rdm;
    st_account = accounts[st_account_n];

    //st_value
    st_value = rdm_value(9007199254740991);

    let timestamp = BigNumber.from((await ethers.provider.getBlock("latest")).timestamp);

    if (st_value == 0) {
      console.log("--revert: 1");
      await expect(voting_escrow.connect(st_account).increase_amount(st_value)).to.revertedWith(
        "dev: need non-zero value"
      );
    } else if (voting_balances[st_account_n]["value"].eq("0")) {
      console.log("--revert: 2");
      await expect(voting_escrow.connect(st_account).increase_amount(st_value)).to.revertedWith(
        "No existing lock found"
      );
    } else if (voting_balances[st_account_n]["unlock_time"].lte(timestamp)) {
      console.log("--revert: 3");
      await expect(voting_escrow.connect(st_account).increase_amount(st_value)).to.revertedWith(
        "Cannot add to expired lock."
      );
    } else {
      await voting_escrow.connect(st_account).increase_amount(st_value);
      voting_balances[st_account_n]["value"] = voting_balances[st_account_n]["value"].add(st_value);

      console.log("--success, account:", st_account_n, "new balance:", voting_balances[st_account_n]["value"]);
    }
  }

  async function rule_increase_unlock_time() {
    console.log("rule_increase_unlock_time");

    //st_account
    let rdm = Math.floor(Math.random() * 10); //0~9 integer
    st_account_n = rdm;
    st_account = accounts[st_account_n];

    //unlock_time
    let timestamp = BigNumber.from((await ethers.provider.getBlock("latest")).timestamp);
    st_lock_duration = rdm_value(255); //number of weeks
    let unlock_time = timestamp.add(st_lock_duration.mul(WEEK)).div(WEEK).mul(WEEK);

    if (voting_balances[st_account_n]["unlock_time"].lte(timestamp)) {
      console.log("--revert: 1");
      await expect(voting_escrow.connect(st_account).increase_unlock_time(unlock_time)).to.revertedWith("Lock expired");
    } else if (voting_balances[st_account_n]["value"].eq("0")) {
      console.log("--revert: 2");
      await expect(voting_escrow.connect(st_account).increase_unlock_time(unlock_time)).to.revertedWith(
        "Nothing is locked"
      );
    } else if (voting_balances[st_account_n]["unlock_time"].gte(unlock_time)) {
      console.log("--revert: 3");
      await expect(voting_escrow.connect(st_account).increase_unlock_time(unlock_time)).to.revertedWith(
        "Can only increase lock duration"
      );
    } else if (unlock_time.gt(timestamp.add(YEAR.mul("4")))) {
      console.log("--revert: 4");
      await expect(voting_escrow.connect(st_account).increase_unlock_time(unlock_time)).to.revertedWith(
        "Voting lock can be 4 years max"
      );
    } else {
      console.log("--success, account:", st_account_n);
      tx = await voting_escrow.connect(st_account).increase_unlock_time(unlock_time);
      receipt = await tx.wait();
      voting_balances[st_account_n]["unlock_time"] = receipt.events[0]["args"]["locktime"];
    }
  }

  async function rule_withdraw() {
    console.log("rule_withdraw");
    // Withdraw tokens from the voting escrow.

    //st_account
    let rdm = Math.floor(Math.random() * 10); //0~9 integer
    st_account_n = rdm;
    st_account = accounts[st_account_n];

    let timestamp = BigNumber.from((await ethers.provider.getBlock("latest")).timestamp);

    if (voting_balances[st_account_n]["unlock_time"].gt(timestamp)) {
      console.log("--reverted");
      await expect(voting_escrow.connect(st_account).withdraw()).to.revertedWith("The lock didn't expire");
    } else {
      console.log("--success, account:", st_account_n);
      await voting_escrow.connect(st_account).withdraw();
      voting_balances[st_account_n]["value"] = BigNumber.from("0");
    }
  }

  async function rule_force_unlock() {
    console.log("rule_force_unlock");

    //st_account
    let rdm = Math.floor(Math.random() * 10); //0~9 integer
    st_account_n = rdm;
    st_account = accounts[st_account_n];

    let target_account_n = Math.floor(Math.random() * 10);
    let target_account = accounts[target_account_n];

    if (st_account == creator) {
      //only creator can execute TestCollateralManager:force_unlock()

      if (voting_balances[target_account_n]["value"].eq(BigNumber.from("0"))) {
        //there is no locked insure token or already withdrawed.
        console.log("--reverted");
        await expect(manager.connect(st_account).force_unlock(target_account.address)).to.revertedWith(
          "There is no locked INSURE"
        );
      } else {
        console.log("--success_force_unlock, account:", target_account_n);
        tx = await manager.connect(st_account).force_unlock(target_account.address);
        await tx.wait();
        voting_balances[target_account_n]["value"] = BigNumber.from("0");
        voting_balances[target_account_n]["unlock_time"] = BigNumber.from("0");
      }
    } else {
      console.log("--reverted");
      await expect(manager.connect(st_account).force_unlock(target_account.address)).to.revertedWith("only admin");
    }
  }

  async function rule_checkpoint() {
    console.log("rule_checkpoint");

    //st_account
    let rdm = Math.floor(Math.random() * 10); //0~9 integer
    st_account_n = rdm;
    st_account = accounts[st_account_n];

    await voting_escrow.connect(st_account).checkpoint();
  }

  async function rule_advance_time() {
    console.log("rule_advance_time");

    let st_sleep_duration = Math.floor(Math.random() * 3) + 1; //1~4
    await ethers.provider.send("evm_increaseTime", [WEEK.mul(st_sleep_duration).toNumber()]);
    await ethers.provider.send("evm_mine");

    if (st_sleep_duration == 1) {
      console.log("Time advanced");
    } else {
      console.log("Time advanced");
    }
  }

  let func = [
    "rule_create_lock",
    "rule_increase_amount",
    "rule_increase_unlock_time",
    "rule_withdraw",
    "rule_checkpoint",
    "rule_advance_time",
    "rule_force_unlock",
  ];

  describe("test_votingescrow_admin", function () {
    //set arbitral number of repeats
    for (let x = 0; x < 20; x++) {
      it("try " + eval("x+1"), async () => {
        for (let i = 0; i < 100; i++) {
          let n = await rdm_value(func.length);
          await eval(func[n])();
        }
      });
    }
  });

  afterEach(async () => {
    console.log("=====Invariant checks=====");

    console.log("invariant_token_balances");
    for (i = 0; i < accounts.lenght; i++) {
      expect(await token.balanceOf(accounts[i].address)).to.equal(ten_to_the_40.sub(voting_balances[i]["value"]));
    }

    console.log("invariant_escrow_current_balances");
    let total_supply = BigNumber.from("0");
    let timestamp = BigNumber.from((await ethers.provider.getBlock("latest")).timestamp);

    for (acct = 0; acct < accounts.length; acct++) {
      let data = voting_balances[acct];

      let balance = await voting_escrow["balanceOf(address)"](accounts[acct].address);
      total_supply = total_supply.add(balance);

      if (data["unlock_time"].gt(timestamp) && data["value"].div(YEAR).gt("0")) {
        expect(balance.isZero()).to.equal(false);
      } else if (data["value"].isZero() || data["unlock_time"].lte(timestamp)) {
        expect(balance.isZero()).to.equal(true);
      }
    }
    expect(await voting_escrow["totalSupply()"]()).to.equal(total_supply);

    console.log("invariant_historic_balances");
    total_supply = BigNumber.from("0");
    let blocknumber = (await ethers.provider.getBlock("latest")).number - 4;
    console.log(blocknumber);

    for (acct = 0; acct < accounts.length; acct++) {
      total_supply = total_supply.add(await voting_escrow.balanceOfAt(accounts[acct].address, blocknumber));
    }

    expect(await voting_escrow.totalSupplyAt(blocknumber)).to.equal(total_supply);
  });
});
