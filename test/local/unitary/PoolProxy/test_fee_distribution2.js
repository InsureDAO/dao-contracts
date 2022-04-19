const { expect } = require("chai");
const { ethers } = require("hardhat");
const { BigNumber } = require("ethers");

async function snapshot() {
  return network.provider.send("evm_snapshot", []);
}

async function restore(snapshotId) {
  return network.provider.send("evm_revert", [snapshotId]);
}

describe("PoolProxy", () => {
  const name = "InsureToken";
  const symbol = "Insure";
  const decimal = 18;
  const INITIAL_SUPPLY = 1303030303000000000000000000;
  const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

  before(async () => {
    //import
    [creator, alice, bob] = await ethers.getSigners();
    const PoolProxy = await ethers.getContractFactory("PoolProxy");
    const Token = await ethers.getContractFactory("TestToken");
    const Ownership = await ethers.getContractFactory("Ownership");
    const Vault = await ethers.getContractFactory("TestVault");
    const Distributor = await ethers.getContractFactory("TestDistributor");
    const Parameters = await ethers.getContractFactory("Parameters");

    //deploy
    /**
     * ownership admin: creator
     * parameter admin: alice
     * emergency admin: bob
     */
    pool_proxy = await PoolProxy.deploy(creator.address, alice.address, bob.address);
    tokenA = await Token.deploy("Token A", "A", 18);
    tokenB = await Token.deploy("Token B", "B", 18);
    fee_token = await Token.deploy("Admin Fee", "FEE", 18);

    dstrA = await Distributor.deploy(tokenA.address);
    dstrB = await Distributor.deploy(tokenB.address);
    dstrC = await Distributor.deploy(fee_token.address);
    dstrD = await Distributor.deploy(fee_token.address);

    //pool contracts deploy
    ownership = await Ownership.deploy();
    vault = await Vault.deploy(fee_token.address);
    vault_A = await Vault.deploy(tokenA.address);

    parameter = await Parameters.deploy(ownership.address);
    await ownership.commitTransferOwnership(pool_proxy.address);
    await pool_proxy.ownership_accept_transfer_ownership(ownership.address);

    await pool_proxy.parameters_set_vault(parameter.address, fee_token.address, vault.address);
    await pool_proxy.set_parameters(parameter.address);
    expect(await parameter.getVault(fee_token.address)).to.equal(vault.address);
  });

  beforeEach(async () => {
    snapshotId = await snapshot();
  });

  afterEach(async () => {
    await restore(snapshotId);
  });

  describe("withdraw_admin_fee", function () {
    it("_token not zero address", async () => {
      await expect(pool_proxy.withdraw_admin_fee(ZERO_ADDRESS)).to.revertedWith("_token cannot be zero address");
    });

    it("allocate correctlly", async () => {
      //setup
      //token transfer to Vault (1000)
      await fee_token._mint_for_testing(1000);
      await fee_token.transfer(vault.address, 1000);

      //add_distributor
      await pool_proxy.add_distributor(fee_token.address, "fee dstr", dstrA.address); //ID = 0

      //set weight (any#)
      await pool_proxy.connect(alice).set_distributor_weight(fee_token.address, 0, 90);

      expect(await pool_proxy.distributor_weight(fee_token.address, 0)).to.equal(90);
      expect(await pool_proxy.total_weights(fee_token.address)).to.equal(90);
      expect(await fee_token.balanceOf(vault.address)).to.equal(1000);

      //withdraw_admin_fee
      await pool_proxy.withdraw_admin_fee(fee_token.address);

      //check (1000)
      expect(await pool_proxy.distributable(fee_token.address, 0)).to.equal(1000);
    });

    it("allocate correctlly multiple distributors", async () => {
      //setup
      //token transfer to Vault
      let amount = BigNumber.from("737373271371234567891");
      await fee_token._mint_for_testing(amount);
      await fee_token.transfer(vault.address, amount);

      //add_distributor
      await pool_proxy.add_distributor(fee_token.address, "fee dstrA", dstrA.address); //ID = 0
      await pool_proxy.add_distributor(fee_token.address, "fee dstrB", dstrB.address); //ID = 1
      await pool_proxy.add_distributor(fee_token.address, "fee dstrC", dstrC.address); //ID = 2

      //set weight (any#)
      await pool_proxy.connect(alice).set_distributor_weight(fee_token.address, 0, 10);
      await pool_proxy.connect(alice).set_distributor_weight(fee_token.address, 1, 13);
      await pool_proxy.connect(alice).set_distributor_weight(fee_token.address, 2, 77);

      expect(await pool_proxy.distributor_weight(fee_token.address, 0)).to.equal(10);
      expect(await pool_proxy.distributor_weight(fee_token.address, 1)).to.equal(13);
      expect(await pool_proxy.distributor_weight(fee_token.address, 2)).to.equal(77);
      expect(await pool_proxy.total_weights(fee_token.address)).to.equal(100);
      expect(await fee_token.balanceOf(vault.address)).to.equal(amount);

      //withdraw_admin_fee
      await pool_proxy.withdraw_admin_fee(fee_token.address);

      //check
      let A_distributable = await pool_proxy.distributable(fee_token.address, 0);
      let B_distributable = await pool_proxy.distributable(fee_token.address, 1);
      let C_distributable = await pool_proxy.distributable(fee_token.address, 2);
      expect(A_distributable).to.equal(amount.mul(10).div(100));
      expect(B_distributable).to.equal(amount.mul(13).div(100));
      expect(C_distributable).to.equal(amount.mul(77).div(100));

      let total = A_distributable.add(B_distributable).add(C_distributable);
      console.log(amount.sub(total).toNumber()); //token left after rounding down.
      expect(amount.gte(total)).to.equal(true);
    });

    it("allocate multipletimes correctlly for multiple distributors", async () => {
      //add_distributor
      await pool_proxy.add_distributor(fee_token.address, "fee dstrA", dstrA.address); //ID = 0
      await pool_proxy.add_distributor(fee_token.address, "fee dstrB", dstrB.address); //ID = 1
      await pool_proxy.add_distributor(fee_token.address, "fee dstrC", dstrC.address); //ID = 2

      //set weight (any#)
      await pool_proxy.connect(alice).set_distributor_weight(fee_token.address, 0, 10);
      await pool_proxy.connect(alice).set_distributor_weight(fee_token.address, 1, 13);
      await pool_proxy.connect(alice).set_distributor_weight(fee_token.address, 2, 77);

      expect(await pool_proxy.distributor_weight(fee_token.address, 0)).to.equal(10);
      expect(await pool_proxy.distributor_weight(fee_token.address, 1)).to.equal(13);
      expect(await pool_proxy.distributor_weight(fee_token.address, 2)).to.equal(77);
      expect(await pool_proxy.total_weights(fee_token.address)).to.equal(100);

      //token transfer to Vault
      let amount = BigNumber.from("737373271371234567891");
      await fee_token._mint_for_testing(amount);
      await fee_token.transfer(vault.address, amount);
      expect(await fee_token.balanceOf(vault.address)).to.equal(amount);

      //withdraw_admin_fee
      await pool_proxy.withdraw_admin_fee(fee_token.address);

      //token transfer to Vault
      let amount_2 = BigNumber.from("9876754321");
      let total_amount = amount.add(amount_2);
      await fee_token._mint_for_testing(amount_2);
      await fee_token.transfer(vault.address, amount_2);

      //withdraw_admin_fee
      await pool_proxy.withdraw_admin_fee(fee_token.address);

      //check
      let A_distributable = await pool_proxy.distributable(fee_token.address, 0);
      let B_distributable = await pool_proxy.distributable(fee_token.address, 1);
      let C_distributable = await pool_proxy.distributable(fee_token.address, 2);

      let A_expected = amount.mul(10).div(100).add(amount_2.mul(10).div(100));
      let B_expected = amount.mul(13).div(100).add(amount_2.mul(13).div(100));
      let C_expected = amount.mul(77).div(100).add(amount_2.mul(77).div(100));

      expect(A_distributable).to.equal(A_expected);
      expect(B_distributable).to.equal(B_expected);
      expect(C_distributable).to.equal(C_expected);

      let total = A_distributable.add(B_distributable).add(C_distributable);
      console.log(total_amount.sub(total).toNumber()); //number of token left after rounding down.
      expect(total_amount.gte(total)).to.equal(true); //total allocated amount never be greater than token amount.
    });
  });

  describe("set_deistributor_kill", function () {
    it("expect revert", async () => {
      await expect(pool_proxy.connect(alice).set_distributor_kill(true)).to.revertedWith("Access denied");
    });

    it("ownership_admin", async () => {
      await pool_proxy.connect(creator).set_distributor_kill(true);

      expect(await pool_proxy.distributor_kill()).to.equal(true);
    });

    it("emergency_admin", async () => {
      await pool_proxy.connect(bob).set_distributor_kill(true);

      expect(await pool_proxy.distributor_kill()).to.equal(true);
    });

    it("multiple call", async () => {
      await pool_proxy.connect(bob).set_distributor_kill(true);
      expect(await pool_proxy.distributor_kill()).to.equal(true);

      await pool_proxy.connect(bob).set_distributor_kill(true);
      expect(await pool_proxy.distributor_kill()).to.equal(true);

      await pool_proxy.connect(creator).set_distributor_kill(false);
      expect(await pool_proxy.distributor_kill()).to.equal(false);

      await pool_proxy.connect(creator).set_distributor_kill(true);
      expect(await pool_proxy.distributor_kill()).to.equal(true);
    });
  });

  describe("distribute()", function () {
    it("expect revert", async () => {
      await pool_proxy.connect(bob).set_distributor_kill(true);

      await expect(pool_proxy.distribute(fee_token.address, 0)).to.revertedWith("distributor is killed");
    });

    it("expect revert", async () => {
      await expect(pool_proxy.distribute(fee_token.address, 0)).to.revertedWith("not added yet");
    });

    it("distribute successflly", async () => {
      //add_distributor
      await pool_proxy.add_distributor(fee_token.address, "fee dstrC", dstrC.address); //ID = 0

      //set weight (any#)
      await pool_proxy.connect(alice).set_distributor_weight(fee_token.address, 0, 10);

      //token transfer to Vault (1000)
      await fee_token._mint_for_testing(1000);
      await fee_token.transfer(vault.address, 1000);

      expect(await fee_token.balanceOf(vault.address)).to.equal(1000);
      expect(await fee_token.balanceOf(pool_proxy.address)).to.equal(0);
      expect(await fee_token.balanceOf(dstrC.address)).to.equal(0);

      //withdraw admin fee
      await pool_proxy.withdraw_admin_fee(fee_token.address);

      expect(await fee_token.balanceOf(vault.address)).to.equal(0);
      expect(await fee_token.balanceOf(pool_proxy.address)).to.equal(1000);
      expect(await fee_token.balanceOf(dstrC.address)).to.equal(0);

      //distribute()
      await pool_proxy.distribute(fee_token.address, 0);

      expect(await pool_proxy.distributable(fee_token.address, 0)).to.equal(0);

      expect(await fee_token.balanceOf(vault.address)).to.equal(0);
      expect(await fee_token.balanceOf(pool_proxy.address)).to.equal(0);
      expect(await fee_token.balanceOf(dstrC.address)).to.equal(1000);
    });

    it("distribute fail", async () => {
      //add_distributor
      await pool_proxy.add_distributor(fee_token.address, "fee dstrC", dstrC.address); //fee_token, ID = 0
      await pool_proxy.add_distributor(tokenA.address, "fee dstrC", dstrC.address); //tokenA, ID = 0
      await pool_proxy.parameters_set_vault(parameter.address, tokenA.address, vault_A.address);

      //set weight (any#)
      await pool_proxy.connect(alice).set_distributor_weight(tokenA.address, 0, 10);

      //token transfer to Vault (1000)
      await tokenA._mint_for_testing(1000);
      await tokenA.transfer(vault_A.address, 1000);

      expect(await tokenA.balanceOf(vault_A.address)).to.equal(1000);
      expect(await tokenA.balanceOf(pool_proxy.address)).to.equal(0);
      expect(await tokenA.balanceOf(dstrC.address)).to.equal(0);

      //withdraw admin fee
      await pool_proxy.withdraw_admin_fee(tokenA.address);

      expect(await tokenA.balanceOf(vault_A.address)).to.equal(0);
      expect(await tokenA.balanceOf(pool_proxy.address)).to.equal(1000);
      expect(await tokenA.balanceOf(dstrC.address)).to.equal(0);

      //distribute()
      await expect(pool_proxy.distribute(tokenA.address, 0)).to.revertedWith("dev: should implement distribute()");

      expect(await pool_proxy.distributable(tokenA.address, 0)).to.equal(1000);

      expect(await tokenA.balanceOf(vault_A.address)).to.equal(0);
      expect(await tokenA.balanceOf(pool_proxy.address)).to.equal(1000);
      expect(await tokenA.balanceOf(dstrC.address)).to.equal(0);
    });

    it("distribute fail, then switch the distributor contract", async () => {
      //add_distributor
      await pool_proxy.add_distributor(fee_token.address, "fee dstrC", dstrC.address); //fee_token, ID = 0
      await pool_proxy.add_distributor(tokenA.address, "fee dstrC", dstrC.address); //tokenA, ID = 0
      await pool_proxy.parameters_set_vault(parameter.address, tokenA.address, vault_A.address);

      //set weight (any#)
      await pool_proxy.connect(alice).set_distributor_weight(tokenA.address, 0, 10);

      //token transfer to Vault (1000)
      await tokenA._mint_for_testing(1000);
      await tokenA.transfer(vault_A.address, 1000);

      //withdraw admin fee
      await pool_proxy.withdraw_admin_fee(tokenA.address);

      //distribute()
      await expect(pool_proxy.distribute(tokenA.address, 0)).to.revertedWith("dev: should implement distribute()");

      expect(await pool_proxy.distributable(tokenA.address, 0)).to.equal(1000);

      expect(await tokenA.balanceOf(vault_A.address)).to.equal(0);
      expect(await tokenA.balanceOf(pool_proxy.address)).to.equal(1000);
      expect(await tokenA.balanceOf(dstrC.address)).to.equal(0);

      //switch
      await pool_proxy.set_distributor(tokenA.address, 0, "distributor_V2", dstrA.address);
      await pool_proxy.distribute(tokenA.address, 0);

      expect(await pool_proxy.distributable(tokenA.address, 0)).to.equal(0);

      expect(await tokenA.balanceOf(vault_A.address)).to.equal(0);
      expect(await tokenA.balanceOf(pool_proxy.address)).to.equal(0);
      expect(await tokenA.balanceOf(dstrA.address)).to.equal(1000);
    });

    it("distribute_many() revert", async () => {
      let addresses = [dstrC.address, dstrD.address];
      let ids = [0, 0];
      let n_id = addresses.length;

      for (i = n_id; i < 20; i++) {
        addresses.push(ZERO_ADDRESS);
        ids.push(0);
      }

      await pool_proxy.connect(bob).set_distributor_kill(true);

      await expect(pool_proxy.distribute_many(addresses, ids)).to.revertedWith("distribution killed");
    });
  });
});
