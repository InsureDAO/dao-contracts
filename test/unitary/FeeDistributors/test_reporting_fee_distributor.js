const { expect } = require("chai");
const { ethers } = require("hardhat");
const { BigNumber } = require('ethers');

describe('ReportingFeeDistributorV1', () => {
    const name = "Fee Token";
    const simbol = "FT";
    const decimal = 18;
    const rpt_decimal = 0;

    const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
    const FEE = BigNumber.from("1000000")
  
    beforeEach(async () => {
      [creator, alice, bob] = await ethers.getSigners();
      const Token = await ethers.getContractFactory('TestToken');
      const Distributor = await ethers.getContractFactory('ReportingDistributionV1');

      fee = await Token.deploy(name, simbol, decimal);
      rpt_token = await Token.deploy(name, simbol, rpt_decimal);
      dstr = await Distributor.deploy(rpt_token.address, fee.address, alice.address, creator.address);
    });

    describe.skip("Condition", function () {
        it("contract should be deployed", async () => {
          await expect(fee.address).to.exist;
          await expect(rpt_token.address).to.exist;
          await expect(dstr.address).to.exist;
        });

        it("check parameters", async()=>{
            expect(await dstr.admin()).to.equal(creator.address);
            expect(await dstr.future_admin()).to.equal(ZERO_ADDRESS);
            expect(await dstr.recovery()).to.equal(alice.address);
            expect(await dstr.insure_reporting()).to.equal(rpt_token.address);
            expect(await dstr.token()).to.equal(fee.address);
        });
    });

    describe.skip("test_register", function () {
        it("register successfull", async()=>{
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

        it("revert zero address", async()=>{
            //add RPT member
            await rpt_token._mint_for_testing(1);

            //register
            await expect(dstr.register_reporter(ZERO_ADDRESS)).to.revertedWith("zero address");
        });

        it("not added if not rpt member", async()=>{
            //register
            await dstr.register_reporter(creator.address);

            expect(await dstr.reporters_length()).to.equal(0);
            expect(await dstr.reporters(1)).to.equal(ZERO_ADDRESS);
            expect(await dstr.has_registered(creator.address)).to.equal(false);
            expect(await dstr.is_kicked(creator.address)).to.equal(false);
            expect(await dstr.active_reporter()).to.equal(0);
        });

        it("revert already registered", async()=>{
            //add RPT member
            await rpt_token._mint_for_testing(1);

            //register
            await dstr.register_reporter(creator.address);
            await expect(dstr.register_reporter(creator.address)).to.revertedWith("already registere");
        });
    });

    describe.skip("test_update_reporter", function(){
        it("registered, rpt member", async()=>{
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

        it("registered, not rpt member", async()=>{
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

        it("registered, not rptmember => rpt member", async()=>{
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

        it("registered, rpt member => not rpt member", async()=>{
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

        it("not registered", async()=>{
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

        it("revert if killed", async()=>{
            //add RPT member
            await rpt_token._mint_for_testing(1);

            //kill contract
            await dstr.kill_me();

            //update
            await expect(dstr.update_reporter(creator.address)).to.revertedWith("dev: contract is killed")
        });

        it("revert if zero address", async()=>{
            //update
            await expect(dstr.update_reporter(ZERO_ADDRESS)).to.revertedWith("zero address");
        });
    });

    describe.skip("test_update_reporter_many", function(){
        it("break; correctlly", async()=>{
            //add RPT member
            await rpt_token._mint_for_testing(1);
            await rpt_token.connect(alice)._mint_for_testing(1);

            //register
            await dstr.register_reporter(creator.address);
            await dstr.register_reporter(alice.address);

            let addresses = [creator.address, alice.address];
            for(i=addresses.length; i<20; i++){
                addresses.push(ZERO_ADDRESS);
            }

            //update
            await dstr.update_reporter_many(addresses);

            //if break; doesn't work correctly, _update_reporter() will fail with ZERO_ADDRESS;
        });

        it("revert if killed", async()=>{
            //add RPT member
            await rpt_token._mint_for_testing(1);
            await rpt_token.connect(alice)._mint_for_testing(1);

            //register
            await dstr.register_reporter(creator.address);
            await dstr.register_reporter(alice.address);

            let addresses = [creator.address, alice.address];
            for(i=addresses.length; i<20; i++){
                addresses.push(ZERO_ADDRESS);
            }

            //kill contract
            await dstr.kill_me();

            //update
            await expect(dstr.update_reporter_many(addresses)).to.revertedWith("dev: contract is killed");
        });
    });

    describe("test_distribute", function(){
        it("distribute correctlly", async()=>{
            //add RPT member
            await rpt_token._mint_for_testing(1);

            //register
            await dstr.register_reporter(creator.address);

            //mint fee and approve to dstr
            await fee.connect(bob)._mint_for_testing(FEE);
            await fee.connect(bob).approve(dstr.address, FEE);

            
        });
    });

    describe.skip("test_bonus_distribute", function(){
        it("", async()=>{

        });
    });

    describe.skip("test_claim", function(){
        it("", async()=>{

        });
    });

    describe.skip("test_config", function(){
        it("", async()=>{

        });
    });


});