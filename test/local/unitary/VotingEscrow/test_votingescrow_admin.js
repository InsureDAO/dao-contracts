const { expect } = require("chai");
const { ethers } = require("hardhat");
const { BigNumber } = require("ethers");

async function snapshot() {
  return network.provider.send("evm_snapshot", []);
}

async function restore(snapshotId) {
  return network.provider.send("evm_revert", [snapshotId]);
}

describe("VotingEscrow", function () {
  const name = "InsureToken";
  const simbol = "Insure";
  const decimal = 18;

  before(async () => {
    //import
    [creator, alice, bob, charly] = await ethers.getSigners();
    const Token = await ethers.getContractFactory("InsureToken");
    const VotingEscrow = await ethers.getContractFactory("VotingEscrow");

    Insure = await Token.deploy(name, simbol);
    ve = await VotingEscrow.deploy(
      Insure.address,
      "Voting-escrowed Insure",
      "veInsure",
      "veInsure"
    );
  });

  beforeEach(async () => {
    snapshotId = await snapshot();
  });

  afterEach(async () => {
    await restore(snapshotId);
  });

  describe("test_votingescrow_admin", function () {
    it("test_commit_admin_only", async () => {
      await expect(
        ve.connect(alice).commit_transfer_ownership(alice.address)
      ).to.revertedWith("only admin");
    });

    it("test_accept_admin_only", async () => {
      await expect(
        ve.connect(alice).accept_transfer_ownership()
      ).to.revertedWith("dev: future_admin only");
    });

    it("test_commit_transfer_ownership", async () => {
      await ve.commit_transfer_ownership(alice.address);

      expect(await ve.admin()).to.equal(creator.address);
      expect(await ve.future_admin()).to.equal(alice.address);
    });

    it("test_accept_transfer_ownership", async () => {
      await ve.commit_transfer_ownership(alice.address);
      expect(await ve.admin()).to.equal(creator.address);
      expect(await ve.future_admin()).to.equal(alice.address);

      await ve.connect(alice).accept_transfer_ownership();

      expect(await ve.admin()).to.equal(alice.address);
      expect(await ve.future_admin()).to.equal(alice.address);
    });
  });
});
