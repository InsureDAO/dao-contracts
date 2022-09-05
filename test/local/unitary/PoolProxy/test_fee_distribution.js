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

    const Distributor = await ethers.getContractFactory("TestDistributor");

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
  });

  beforeEach(async () => {
    snapshotId = await snapshot();
  });

  afterEach(async () => {
    await restore(snapshotId);
  });

  describe("Condition", function () {
    it("contract should be deployed", async () => {
      expect(pool_proxy.address).to.exist;
    });
  });

  describe("add_distributor", function () {
    it("only_ownership_admin", async () => {
      await expect(
        pool_proxy.connect(alice).add_distributor(tokenA.address, "dstrA for tokenA", dstrA.address)
      ).to.revertedWith("only ownership admin");
    });

    it("token cannot be zero address", async () => {
      await expect(pool_proxy.add_distributor(ZERO_ADDRESS, "dstrA for zero_address", dstrA.address)).to.revertedWith(
        "_token cannot be zero address"
      );
    });

    it("id incremented correctlly", async () => {
      await pool_proxy.add_distributor(tokenA.address, "dstrA for tokenA", dstrA.address);
      expect(await pool_proxy.n_distributors(tokenA.address)).to.equal(1);
    });

    it("distributor set correctlly", async () => {
      await pool_proxy.add_distributor(tokenA.address, "dstrA for tokenA", dstrA.address);
      expect(await pool_proxy.get_distributor_name(tokenA.address, 0)).to.equal("dstrA for tokenA");
      expect(await pool_proxy.get_distributor_address(tokenA.address, 0)).to.equal(dstrA.address);
    });

    it("distributor weight must be zero", async () => {
      await pool_proxy.add_distributor(tokenA.address, "dstrA for tokenA", dstrA.address);
      expect(await pool_proxy.distributor_weight(tokenA.address, 0)).to.equal(0);
    });
  });

  describe("set_distributor_weight", function () {
    it("only parameter admin", async () => {
      await pool_proxy.add_distributor(tokenA.address, "dstrA for tokenA", dstrA.address);
      await expect(pool_proxy.set_distributor_weight(tokenA.address, 0, 1000)).to.revertedWith("only parameter admin");
    });

    it("cannot set weight for not added ID", async () => {
      await expect(pool_proxy.connect(alice).set_distributor_weight(tokenA.address, 0, 1000)).to.revertedWith(
        "not added yet"
      );
    });

    it("set weight correctlly", async () => {
      await pool_proxy.add_distributor(tokenA.address, "dstrA for tokenA", dstrA.address);
      await pool_proxy.connect(alice).set_distributor_weight(tokenA.address, 0, 1000);

      expect(await pool_proxy.distributor_weight(tokenA.address, 0)).to.equal(1000);
      expect(await pool_proxy.total_weights(tokenA.address)).to.equal(1000);
    });
  });

  describe("set_distributor_weight_many", function () {
    it("only parameter admin", async () => {
      let addresses = [dstrA.address, dstrB.address];

      let tokens = [tokenA.address, tokenA.address];
      let ids = [0, 1];
      let weights = [1000, 9000];
      let n_id = addresses.length;

      for (i = n_id; i < 20; i++) {
        tokens.push(ZERO_ADDRESS);
        ids.push(0);
        weights.push(0);
      }
      expect(tokens.length).to.equal(20);
      expect(ids.length).to.equal(20);
      expect(weights.length).to.equal(20);

      //add dstrA and dstrB for TokenA.
      for (i = 0; i < n_id; i++) {
        await pool_proxy.add_distributor(tokenA.address, "tokenA dstr", addresses[i]);
      }

      await expect(pool_proxy.set_distributor_weight_many(tokens, ids, weights)).to.revertedWith(
        "only parameter admin"
      );
    });

    it("set weights correctlly", async () => {
      let addresses = [dstrA.address, dstrB.address];

      let tokens = [tokenA.address, tokenA.address];
      let ids = [0, 1];
      let weights = [1000, 9000];
      let n_id = addresses.length;

      for (i = n_id; i < 20; i++) {
        tokens.push(ZERO_ADDRESS);
        ids.push(0);
        weights.push(0);
      }
      await expect(tokens.length).to.equal(20);
      await expect(ids.length).to.equal(20);
      await expect(weights.length).to.equal(20);

      //add dstrA and dstrB for TokenA.
      for (i = 0; i < n_id; i++) {
        await pool_proxy.add_distributor(tokenA.address, "tokenA dstr", addresses[i]);
      }

      await pool_proxy.connect(alice).set_distributor_weight_many(tokens, ids, weights);

      //check
      expect(await pool_proxy.distributor_weight(tokenA.address, 0)).to.equal(1000);
      expect(await pool_proxy.distributor_weight(tokenA.address, 1)).to.equal(9000);
      expect(await pool_proxy.total_weights(tokenA.address)).to.equal(10000); //sum of weights
    });
  });

  describe("set_distributor", function () {
    it("only admin", async () => {
      await pool_proxy.add_distributor(tokenA.address, "dstrA for tokenA", dstrA.address);
      await expect(
        pool_proxy.connect(alice).set_distributor(tokenA.address, 0, "tokenA dstr V2", dstrB.address)
      ).to.revertedWith("only ownership admin");
    });

    it("cannot set to not added purpose", async () => {
      await expect(pool_proxy.set_distributor(tokenA.address, 0, "tokenA dstr v2", dstrB.address)).to.revertedWith(
        "not added yet"
      );
    });

    it("set distributor correctlly", async () => {
      await pool_proxy.add_distributor(tokenA.address, "tokenA dstr V1", dstrA.address);
      await pool_proxy.set_distributor(tokenA.address, 0, "tokenA dstr V2", dstrB.address);

      expect(await pool_proxy.get_distributor_name(tokenA.address, 0)).to.equal("tokenA dstr V2");
      expect(await pool_proxy.get_distributor_address(tokenA.address, 0)).to.equal(dstrB.address);
    });

    it("set weight => set distributor. inherit the weight", async () => {
      await pool_proxy.add_distributor(tokenA.address, "tokenA dstr V1", dstrA.address);
      await pool_proxy.connect(alice).set_distributor_weight(tokenA.address, 0, 1000);

      await pool_proxy.set_distributor(tokenA.address, 0, "tokenA dstr V2", dstrB.address);

      //weight
      expect(await pool_proxy.distributor_weight(tokenA.address, 0)).to.equal(1000);

      //totalweight
      expect(await pool_proxy.total_weights(tokenA.address)).to.equal(1000);
    });

    it("set weight => set distributor to zero address. resets the weight", async () => {
      await pool_proxy.add_distributor(tokenA.address, "tokenA dstr V1", dstrA.address);
      await pool_proxy.connect(alice).set_distributor_weight(tokenA.address, 0, 1000);

      await pool_proxy.set_distributor(tokenA.address, 0, "tokenA dstr V2", ZERO_ADDRESS);

      //weight
      expect(await pool_proxy.distributor_weight(tokenA.address, 0)).to.equal(0);

      //totalweight
      expect(await pool_proxy.total_weights(tokenA.address)).to.equal(0);
    });

    it("cannot set weight for zero address distributor", async () => {
      await pool_proxy.add_distributor(tokenA.address, "tokenA dstr V1", dstrA.address);
      await pool_proxy.connect(alice).set_distributor_weight(tokenA.address, 0, 1000);

      await pool_proxy.set_distributor(tokenA.address, 0, "tokenA dstr V2", ZERO_ADDRESS);

      await expect(pool_proxy.connect(alice).set_distributor_weight(tokenA.address, 0, 1000)).to.revertedWith(
        "distributor not set"
      );
    });
  });
});
