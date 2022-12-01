import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { BigNumber, constants } from "ethers";
import {
  govFeeDistributorDeploy,
  govFeeDistributorDeployAfterLock,
  govFeeDistributorWithRunningVotingEscrow,
} from "../../../../utils/fixtures/GovFeeDistributorDeploy";

const WEEK = BigNumber.from(86_400 * 7);

describe("claim", () => {
  describe("claim()", () => {
    it("should checkpoint token supply before claim", async () => {
      const { govFeeDistributor } = await loadFixture(govFeeDistributorDeploy);

      await time.increase(WEEK);

      await expect(govFeeDistributor["claim()"]())
        .to.emit(govFeeDistributor, "ITokenCheckpointed")
        .to.emit(govFeeDistributor, "VeCheckpointed");
    });

    it("should not claim any amount of the reward in case the INSURE is deposited before", async () => {
      const { govFeeDistributor, alice, reservePool, usdc } = await loadFixture(
        govFeeDistributorDeployAfterLock
      );

      await govFeeDistributor["depositBalanceToReserve()"]();
      await expect(
        govFeeDistributor.connect(alice)["claim()"]()
      ).changeTokenBalance(reservePool, alice, 0);
    });

    it("should returns 0 in case no lock found", async () => {
      const { govFeeDistributor, charlie } = await loadFixture(
        govFeeDistributorDeploy
      );

      await expect(govFeeDistributor.connect(charlie)["claim()"]()).not.to.emit(
        govFeeDistributor,
        "Claimed"
      );
    });

    it("should claim all iToken reward for alice", async () => {
      const {
        govFeeDistributor,
        votingEscrow,
        reservePool: iToken,
        alice,
      } = await loadFixture(govFeeDistributorDeploy);

      // assume 2 weeks passed from now
      await time.increase(WEEK.mul(2));

      // convert USDC to iToken
      await govFeeDistributor["depositBalanceToReserve()"]();

      // checkpoint to estimate receive amount
      await govFeeDistributor.iTokenCheckPoint();
      await govFeeDistributor.veSupplyCheckpoint();

      const distributionStart = await govFeeDistributor.distributionStart();
      const firstWeek = distributionStart.add(WEEK);
      const secondWeek = firstWeek.add(WEEK);

      // get global supply
      const firstWeekVeSupply = await govFeeDistributor.veSupplyAt(firstWeek);
      const firstWeekITokenSupply = await govFeeDistributor.iTokenSupplyAt(
        firstWeek
      );

      const secondWeekVeSupply = await govFeeDistributor.veSupplyAt(secondWeek);
      const secondWeekITokenSupply = await govFeeDistributor.iTokenSupplyAt(
        secondWeek
      );

      // alice veINSURE balance
      const aliceCheckpoint = await votingEscrow.user_point_history(
        alice.address,
        1
      );

      const dtFromFirstWeek = BigNumber.from(firstWeek).sub(aliceCheckpoint.ts);
      const dtFromSecondWeek = BigNumber.from(secondWeek).sub(
        aliceCheckpoint.ts
      );

      // veINSURE balance is deducted during the time
      const firstWeekAliceVeINSUREBalance = aliceCheckpoint.bias.sub(
        aliceCheckpoint.slope.mul(dtFromFirstWeek)
      );
      const secondWeekAliceVeINSUREBalance = aliceCheckpoint.bias.sub(
        aliceCheckpoint.slope.mul(dtFromSecondWeek)
      );

      // receive iToken amount is sum of two weeks
      const firstWeekITokenAliceReceive = firstWeekAliceVeINSUREBalance
        .mul(firstWeekITokenSupply)
        .div(firstWeekVeSupply);

      const secondWeekITokenAliceReceive = secondWeekAliceVeINSUREBalance
        .mul(secondWeekITokenSupply)
        .div(secondWeekVeSupply);

      const expectITokenReceive = firstWeekITokenAliceReceive.add(
        secondWeekITokenAliceReceive
      );

      const beforeBalance = await govFeeDistributor.lastITokenBalance();

      await expect(
        govFeeDistributor.connect(alice)["claim()"]()
      ).to.changeTokenBalance(iToken, alice, expectITokenReceive);

      expect(await govFeeDistributor.lastITokenBalance()).to.eq(
        beforeBalance.sub(expectITokenReceive)
      );
    });

    it("should be 0 if user oldest ve checkpoint is after latest iToken checkpoint", async () => {
      const {
        govFeeDistributor,
        reservePool: iToken,
        alice,
      } = await loadFixture(govFeeDistributorDeploy);

      // assume 1 week passed from now
      await time.increase(WEEK);

      // convert USDC to iToken
      await govFeeDistributor["depositBalanceToReserve()"]();

      // checkpoint to estimate receive amount
      await govFeeDistributor.iTokenCheckPoint();
      await govFeeDistributor.veSupplyCheckpoint();

      await expect(
        govFeeDistributor.connect(alice)["claim()"]()
      ).to.changeTokenBalance(iToken, alice, 0);

      const beforeBalance = await govFeeDistributor.lastITokenBalance();

      expect(await govFeeDistributor.lastITokenBalance()).to.eq(beforeBalance);
    });

    it("should be claimed in case user checkpoint veToken multiple times", async () => {
      const {
        govFeeDistributor,
        votingEscrow,
        reservePool: iToken,
        alice,
      } = await loadFixture(govFeeDistributorDeploy);

      // 1 week passed
      await time.increase(WEEK);

      const now = await time.latest();

      // lock additional INSURE 4 years
      await votingEscrow
        .connect(alice)
        .increase_amount(10_000_000n * 10n ** 18n);

      // 1 week passed
      await time.increase(WEEK);

      // convert USDC to iToken
      await govFeeDistributor["depositBalanceToReserve()"]();

      // checkpoint to estimate receive amount
      await govFeeDistributor.iTokenCheckPoint();
      await govFeeDistributor.veSupplyCheckpoint();

      const distributionStart = await govFeeDistributor.distributionStart();
      const firstWeek = distributionStart.add(WEEK);
      const secondWeek = firstWeek.add(WEEK);

      // get global supply
      const firstWeekVeSupply = await govFeeDistributor.veSupplyAt(firstWeek);
      const firstWeekITokenSupply = await govFeeDistributor.iTokenSupplyAt(
        firstWeek
      );

      const secondWeekVeSupply = await govFeeDistributor.veSupplyAt(secondWeek);
      const secondWeekITokenSupply = await govFeeDistributor.iTokenSupplyAt(
        secondWeek
      );

      // alice veINSURE balance
      const aliceFirstWeekCheckpoint = await votingEscrow.user_point_history(
        alice.address,
        1
      );

      const aliceSecondWeekCheckpoint = await votingEscrow.user_point_history(
        alice.address,
        2
      );

      const dtFromFirstWeek = BigNumber.from(firstWeek).sub(
        aliceFirstWeekCheckpoint.ts
      );
      const dtFromSecondWeek = BigNumber.from(secondWeek).sub(
        aliceSecondWeekCheckpoint.ts
      );

      // veINSURE balance is deducted during the time
      const firstWeekAliceVeINSUREBalance = aliceFirstWeekCheckpoint.bias.sub(
        aliceFirstWeekCheckpoint.slope.mul(dtFromFirstWeek)
      );
      const secondWeekAliceVeINSUREBalance = aliceSecondWeekCheckpoint.bias.sub(
        aliceSecondWeekCheckpoint.slope.mul(dtFromSecondWeek)
      );

      // receive iToken amount is sum of two weeks
      const firstWeekITokenAliceReceive = firstWeekAliceVeINSUREBalance
        .mul(firstWeekITokenSupply)
        .div(firstWeekVeSupply);

      const secondWeekITokenAliceReceive = secondWeekAliceVeINSUREBalance
        .mul(secondWeekITokenSupply)
        .div(secondWeekVeSupply);

      const expectITokenReceive = firstWeekITokenAliceReceive.add(
        secondWeekITokenAliceReceive
      );

      const beforeBalance = await govFeeDistributor.lastITokenBalance();

      await expect(
        govFeeDistributor.connect(alice)["claim()"]()
      ).to.changeTokenBalance(iToken, alice, expectITokenReceive);

      expect(await govFeeDistributor.lastITokenBalance()).to.eq(
        beforeBalance.sub(expectITokenReceive)
      );
    });

    it("should be claimed in case distribution started in the middle of votingEscrow running", async () => {
      const {
        govFeeDistributor,
        votingEscrow,
        reservePool: iToken,
        alice,
      } = await loadFixture(govFeeDistributorWithRunningVotingEscrow);

      await time.increase(WEEK.mul(2));

      // convert USDC to iToken
      await govFeeDistributor["depositBalanceToReserve()"]();

      // checkpoint to estimate receive amount
      await govFeeDistributor.iTokenCheckPoint();
      await govFeeDistributor.veSupplyCheckpoint();

      // INSURE locked before distribution start, so first supply checkpoint is distribution start time
      const firstWeek = await govFeeDistributor.distributionStart();
      const secondWeek = firstWeek.add(WEEK);
      const thirdWeek = secondWeek.add(WEEK);

      // get global supply
      const firstWeekVeSupply = await govFeeDistributor.veSupplyAt(firstWeek);
      const firstWeekITokenSupply = await govFeeDistributor.iTokenSupplyAt(
        firstWeek
      );

      const secondWeekVeSupply = await govFeeDistributor.veSupplyAt(secondWeek);
      const secondWeekITokenSupply = await govFeeDistributor.iTokenSupplyAt(
        secondWeek
      );

      const thirdWeekVeSupply = await govFeeDistributor.veSupplyAt(thirdWeek);
      const thirdWeekITokenSupply = await govFeeDistributor.iTokenSupplyAt(
        thirdWeek
      );

      // alice veINSURE balance
      const aliceFirstCheckpoint = await votingEscrow.user_point_history(
        alice.address,
        1
      );
      const aliceSecondCheckpoint = await votingEscrow.user_point_history(
        alice.address,
        2
      );

      // first checkpoint is behind first week boundary
      const dtFromFirstWeek = BigNumber.from(firstWeek).sub(
        aliceFirstCheckpoint.ts
      );
      // second checkpoint is behind second and third week boundary
      const dtFromSecondWeek = BigNumber.from(secondWeek).sub(
        aliceSecondCheckpoint.ts
      );
      const dtFromThirdWeek = BigNumber.from(thirdWeek).sub(
        aliceSecondCheckpoint.ts
      );

      // veINSURE balance is deducted during the time
      const firstWeekAliceVeINSUREBalance = aliceFirstCheckpoint.bias.sub(
        aliceFirstCheckpoint.slope.mul(dtFromFirstWeek)
      );
      const secondWeekAliceVeINSUREBalance = aliceSecondCheckpoint.bias.sub(
        aliceSecondCheckpoint.slope.mul(dtFromSecondWeek)
      );
      const thirdWeekAliceVeINSUREBalance = aliceSecondCheckpoint.bias.sub(
        aliceSecondCheckpoint.slope.mul(dtFromThirdWeek)
      );

      // receive iToken amount is sum of two weeks
      const firstWeekITokenAliceReceive = firstWeekAliceVeINSUREBalance
        .mul(firstWeekITokenSupply)
        .div(firstWeekVeSupply);

      const secondWeekITokenAliceReceive = secondWeekAliceVeINSUREBalance
        .mul(secondWeekITokenSupply)
        .div(secondWeekVeSupply);

      const thirdWeekITokenAliceReceive = thirdWeekAliceVeINSUREBalance
        .mul(thirdWeekITokenSupply)
        .div(thirdWeekVeSupply);

      const expectITokenReceive = firstWeekITokenAliceReceive
        .add(secondWeekITokenAliceReceive)
        .add(thirdWeekITokenAliceReceive);

      const beforeBalance = await govFeeDistributor.lastITokenBalance();

      await expect(
        govFeeDistributor.connect(alice)["claim()"]()
      ).to.changeTokenBalance(iToken, alice, expectITokenReceive);

      expect(await govFeeDistributor.lastITokenBalance()).to.eq(
        beforeBalance.sub(expectITokenReceive)
      );
    });
  });

  describe("claim(address)", () => {
    it("should be claimed to bob by alice", async () => {
      const {
        govFeeDistributor,
        votingEscrow,
        reservePool: iToken,
        alice,
        bob,
      } = await loadFixture(govFeeDistributorDeploy);

      // assume 2 weeks passed from now
      await time.increase(WEEK.mul(2));

      // convert USDC to iToken
      await govFeeDistributor["depositBalanceToReserve()"]();

      // checkpoint to estimate receive amount
      await govFeeDistributor.iTokenCheckPoint();
      await govFeeDistributor.veSupplyCheckpoint();

      const distributionStart = await govFeeDistributor.distributionStart();
      const firstWeek = distributionStart.add(WEEK);
      const secondWeek = firstWeek.add(WEEK);

      // get global supply
      const firstWeekVeSupply = await govFeeDistributor.veSupplyAt(firstWeek);
      const firstWeekITokenSupply = await govFeeDistributor.iTokenSupplyAt(
        firstWeek
      );

      const secondWeekVeSupply = await govFeeDistributor.veSupplyAt(secondWeek);
      const secondWeekITokenSupply = await govFeeDistributor.iTokenSupplyAt(
        secondWeek
      );

      // alice veINSURE balance
      const aliceCheckpoint = await votingEscrow.user_point_history(
        alice.address,
        1
      );

      const dtFromFirstWeek = BigNumber.from(firstWeek).sub(aliceCheckpoint.ts);
      const dtFromSecondWeek = BigNumber.from(secondWeek).sub(
        aliceCheckpoint.ts
      );

      // veINSURE balance is deducted during the time
      const firstWeekBobVeINSUREBalance = aliceCheckpoint.bias.sub(
        aliceCheckpoint.slope.mul(dtFromFirstWeek)
      );
      const secondWeekBobVeINSUREBalance = aliceCheckpoint.bias.sub(
        aliceCheckpoint.slope.mul(dtFromSecondWeek)
      );

      // receive iToken amount is sum of two weeks
      const firstWeekITokenBobReceive = firstWeekBobVeINSUREBalance
        .mul(firstWeekITokenSupply)
        .div(firstWeekVeSupply);

      const secondWeekITokenBobReceive = secondWeekBobVeINSUREBalance
        .mul(secondWeekITokenSupply)
        .div(secondWeekVeSupply);

      const expectITokenReceive = firstWeekITokenBobReceive.add(
        secondWeekITokenBobReceive
      );

      const beforeBalance = await govFeeDistributor.lastITokenBalance();

      await expect(
        govFeeDistributor.connect(alice)["claim(address)"](bob.address)
      ).to.changeTokenBalance(iToken, bob, expectITokenReceive);

      expect(await govFeeDistributor.lastITokenBalance()).to.eq(
        beforeBalance.sub(expectITokenReceive)
      );
    });
  });

  describe("claimMany", async () => {
    it("should be claimed for alice and bob both", async () => {
      const {
        govFeeDistributor,
        votingEscrow,
        reservePool: iToken,
        alice,
        bob,
      } = await loadFixture(govFeeDistributorDeploy);

      // bob locks additional insure
      await votingEscrow.connect(bob).increase_amount(10_000_000n * 10n ** 18n);

      // assume 2 weeks passed from now
      await time.increase(WEEK.mul(2));

      // convert USDC to iToken
      await govFeeDistributor["depositBalanceToReserve()"]();

      // checkpoint to estimate receive amount
      await govFeeDistributor.iTokenCheckPoint();
      await govFeeDistributor.veSupplyCheckpoint();

      const distributionStart = await govFeeDistributor.distributionStart();
      const firstWeek = distributionStart.add(WEEK);
      const secondWeek = firstWeek.add(WEEK);

      // get global supply
      const firstWeekVeSupply = await govFeeDistributor.veSupplyAt(firstWeek);
      const firstWeekITokenSupply = await govFeeDistributor.iTokenSupplyAt(
        firstWeek
      );

      const secondWeekVeSupply = await govFeeDistributor.veSupplyAt(secondWeek);
      const secondWeekITokenSupply = await govFeeDistributor.iTokenSupplyAt(
        secondWeek
      );

      // veINSURE checkpoints
      const aliceCheckpoint = await votingEscrow.user_point_history(
        alice.address,
        1
      );
      const bobCheckpoint = await votingEscrow.user_point_history(
        bob.address,
        2
      );

      const aliceDtFromFirstWeek = BigNumber.from(firstWeek).sub(
        aliceCheckpoint.ts
      );
      const aliceDtFromSecondWeek = BigNumber.from(secondWeek).sub(
        aliceCheckpoint.ts
      );
      const bobDtFromFirstWeek = BigNumber.from(firstWeek).sub(
        bobCheckpoint.ts
      );
      const bobDtFromSecondWeek = BigNumber.from(secondWeek).sub(
        bobCheckpoint.ts
      );

      // veINSURE balance is deducted during the time
      const firstWeekAliceVeINSUREBalance = aliceCheckpoint.bias.sub(
        aliceCheckpoint.slope.mul(aliceDtFromFirstWeek)
      );
      const secondWeekAliceVeINSUREBalance = aliceCheckpoint.bias.sub(
        aliceCheckpoint.slope.mul(aliceDtFromSecondWeek)
      );
      const firstWeekBobVeINSUREBalance = bobCheckpoint.bias.sub(
        bobCheckpoint.slope.mul(bobDtFromFirstWeek)
      );
      const secondWeekBobVeINSUREBalance = bobCheckpoint.bias.sub(
        bobCheckpoint.slope.mul(bobDtFromSecondWeek)
      );

      // receive iToken amount is sum of two weeks
      const firstWeekITokenAliceReceive = firstWeekAliceVeINSUREBalance
        .mul(firstWeekITokenSupply)
        .div(firstWeekVeSupply);

      const secondWeekITokenAliceReceive = secondWeekAliceVeINSUREBalance
        .mul(secondWeekITokenSupply)
        .div(secondWeekVeSupply);

      const firstWeekITokenBobReceive = firstWeekBobVeINSUREBalance
        .mul(firstWeekITokenSupply)
        .div(firstWeekVeSupply);

      const secondWeekITokenBobReceive = secondWeekBobVeINSUREBalance
        .mul(secondWeekITokenSupply)
        .div(secondWeekVeSupply);

      const expectITokenAliceReceive = firstWeekITokenAliceReceive.add(
        secondWeekITokenAliceReceive
      );

      const expectITokenBobReceive = firstWeekITokenBobReceive.add(
        secondWeekITokenBobReceive
      );

      const receivers = new Array<string>(20).fill(constants.AddressZero);
      receivers[0] = alice.address;
      receivers[1] = bob.address;

      const beforeBalance = await govFeeDistributor.lastITokenBalance();

      await expect(
        govFeeDistributor.claimMany(receivers)
      ).to.changeTokenBalances(
        iToken,
        [alice, bob],
        [expectITokenAliceReceive, expectITokenBobReceive]
      );

      expect(await govFeeDistributor.lastITokenBalance()).to.eq(
        beforeBalance.sub(expectITokenAliceReceive.add(expectITokenBobReceive))
      );
    });
  });
});
