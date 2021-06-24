const { expect } = require("chai");
const { ethers } = require("hardhat");
const { BigNumber } = require('ethers');

describe('PoolProxy', () => {
    const name = "InsureToken";
    const simbol = "Insure";
    const decimal = 18;
    const INITIAL_SUPPLY = 1303030303000000000000000000;

  
    beforeEach(async () => {
      //import
      [creator, alice, bob] = await ethers.getSigners();
      const PoolProxy = await ethers.getContractFactory('PoolProxy');

      //deploy
      pool_proxy = await PoolProxy.deploy(creator.address, alice.address, bob.address);
    });

    describe("Condition", function () {
        it("contract should be deployed", async () => {
          expect(pool_proxy.address).to.exist;
        });
    });

    describe("Admin Check", function () {
      it("", async () => {
        
      });

      it("test_admin_for_multiple_pools", async()=> {
        
      });
    });
});