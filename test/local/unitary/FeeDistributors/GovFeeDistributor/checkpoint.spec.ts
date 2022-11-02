import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";
import { BigNumber } from "ethers";

import { expect } from "chai";
import {
  govFeeDistributorDeploy,
  govFeeDistributorWithRunningVotingEscrow,
} from "../../../../utils/fixtures/GovFeeDistributorDeploy";

const WEEK = BigNumber.from(86_400 * 7);

describe("checkpoint", () => {
  describe("depositBalanceToReserve", () => {
    it("should deposit all usdc admin fee into reserve pool", async () => {
      const { govFeeDistributor, reservePool } = await loadFixture(
        govFeeDistributorDeploy
      );

      await expect(
        reservePool.balanceOf(govFeeDistributor.address)
      ).to.eventually.eq(0);

      await govFeeDistributor["depositBalanceToReserve()"]();

      await expect(
        reservePool.balanceOf(govFeeDistributor.address)
      ).to.eventually.gt(0);
    });

    it("should withdraw part of usdc admin fee into reserve pool", async () => {
      const { govFeeDistributor, reservePool, usdc } = await loadFixture(
        govFeeDistributorDeploy
      );
      const usdcBalance = await usdc.balanceOf(govFeeDistributor.address);

      await expect(
        reservePool.balanceOf(govFeeDistributor.address)
      ).to.eventually.eq(0);

      await govFeeDistributor["depositBalanceToReserve(uint256)"](
        usdcBalance.div(2)
      );

      await expect(
        usdc.balanceOf(govFeeDistributor.address)
      ).to.eventually.approximately(usdcBalance.div(2).toNumber(), 1);

      await expect(
        reservePool.balanceOf(govFeeDistributor.address)
      ).to.eventually.gt(0);
    });
  });

  describe("iTokenCheckpoint", () => {
    it("should initially checkpoint iToken", async () => {
      const { govFeeDistributor, reservePool } = await loadFixture(
        govFeeDistributorDeploy
      );

      const now = await time.latest();
      const weekStart = BigNumber.from(now).div(WEEK).mul(WEEK);

      await govFeeDistributor["depositBalanceToReserve()"]();
      await expect(govFeeDistributor.iTokenSupply(weekStart)).to.eventually.eq(
        0
      );

      const iTokenBalance = await reservePool.balanceOf(
        govFeeDistributor.address
      );

      await govFeeDistributor.iTokenCheckPoint();

      await expect(govFeeDistributor.iTokenSupply(weekStart)).to.eventually.eq(
        iTokenBalance
      );
    });

    it("should checkpoint multiple weeks", async () => {
      const { govFeeDistributor, reservePool } = await loadFixture(
        govFeeDistributorDeploy
      );
      const start = BigNumber.from(await govFeeDistributor.lastITokenTime());
      const thisWeek = start.div(WEEK).mul(WEEK);
      const nextWeek = thisWeek.add(WEEK);
      const inTwoWeeks = nextWeek.add(WEEK);
      const inThreeWeeks = inTwoWeeks.add(WEEK);
      const destination = WEEK.mul(3).add(start);
      const entireDuration = destination.sub(start);

      // pass 3 weeks
      await time.increaseTo(destination);
      await govFeeDistributor["depositBalanceToReserve()"]();
      const distribution = await reservePool.balanceOf(
        govFeeDistributor.address
      );
      const expectDistributionThisWeek = nextWeek
        .sub(start)
        .mul(distribution)
        .div(entireDuration);
      const expectDistributionNextWeek =
        WEEK.mul(distribution).div(entireDuration);
      const expectDistributionInTwoWeeks =
        WEEK.mul(distribution).div(entireDuration);
      const expectDistributionInThreeWeeks = destination
        .sub(inThreeWeeks)
        .mul(distribution)
        .div(entireDuration);

      await govFeeDistributor.iTokenCheckPoint();

      await expect(
        govFeeDistributor.iTokenSupply(thisWeek)
      ).eventually.approximately(
        expectDistributionThisWeek.toNumber(),
        100,
        "first week supply differ"
      );
      await expect(
        govFeeDistributor.iTokenSupply(nextWeek)
      ).eventually.approximately(
        expectDistributionNextWeek.toNumber(),
        100,
        "nextWeek supply differ"
      );
      await expect(
        govFeeDistributor.iTokenSupply(inTwoWeeks)
      ).eventually.approximately(
        expectDistributionInTwoWeeks.toNumber(),
        100,
        "in two weeks supply differ"
      );
      await expect(
        govFeeDistributor.iTokenSupply(inThreeWeeks)
      ).eventually.approximately(
        expectDistributionInThreeWeeks.toNumber(),
        100,
        "in three weeks supply differ"
      );
    });
  });

  describe("veSupplyCheckpoint", async () => {
    it("should initially checkpoint veINSURE", async () => {
      const { govFeeDistributor, votingEscrow } = await loadFixture(
        govFeeDistributorDeploy
      );

      await time.increase(WEEK.mul(2));
      const distributionStart = await govFeeDistributor.distributionStart();
      const latestWeekCursor = distributionStart.add(WEEK);

      // before checkpoint, veSupply should be recorded as zero
      await expect(
        govFeeDistributor.veSupply(latestWeekCursor)
      ).eventually.to.eq(0);

      // checkpoint
      await govFeeDistributor.veSupplyCheckpoint();

      const thirdCheckpoint = await votingEscrow.point_history(3);
      const dt = BigNumber.from(latestWeekCursor).sub(thirdCheckpoint.ts);

      // at the week start point, supply should be deducted as much as the time passed since checkpoint
      const deductedSupply = thirdCheckpoint.bias.sub(
        thirdCheckpoint.slope.mul(dt)
      );
      await expect(
        govFeeDistributor.veSupply(latestWeekCursor)
      ).to.eventually.eq(deductedSupply);
    });
  });

  describe("claim()", () => {
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
      const firstWeekVeSupply = await govFeeDistributor.veSupply(firstWeek);
      const firstWeekITokenSupply = await govFeeDistributor.iTokenSupply(
        firstWeek
      );

      const secondWeekVeSupply = await govFeeDistributor.veSupply(secondWeek);
      const secondWeekITokenSupply = await govFeeDistributor.iTokenSupply(
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

      await expect(
        govFeeDistributor.connect(alice)["claim()"]()
      ).to.changeTokenBalance(iToken, alice, expectITokenReceive);
    });

    it("should be 0 if user oldest ve checkpoint is after latest iToken checkpoint", async () => {
      const {
        govFeeDistributor,
        votingEscrow,
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
      const firstWeekVeSupply = await govFeeDistributor.veSupply(firstWeek);
      const firstWeekITokenSupply = await govFeeDistributor.iTokenSupply(
        firstWeek
      );

      const secondWeekVeSupply = await govFeeDistributor.veSupply(secondWeek);
      const secondWeekITokenSupply = await govFeeDistributor.iTokenSupply(
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

      await expect(
        govFeeDistributor.connect(alice)["claim()"]()
      ).to.changeTokenBalance(iToken, alice, expectITokenReceive);
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
      const firstWeekVeSupply = await govFeeDistributor.veSupply(firstWeek);
      const firstWeekITokenSupply = await govFeeDistributor.iTokenSupply(
        firstWeek
      );

      const secondWeekVeSupply = await govFeeDistributor.veSupply(secondWeek);
      const secondWeekITokenSupply = await govFeeDistributor.iTokenSupply(
        secondWeek
      );

      const thirdWeekVeSupply = await govFeeDistributor.veSupply(thirdWeek);
      const thirdWeekITokenSupply = await govFeeDistributor.iTokenSupply(
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

      await expect(
        govFeeDistributor.connect(alice)["claim()"]()
      ).to.changeTokenBalance(iToken, alice, expectITokenReceive);
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
      const firstWeekVeSupply = await govFeeDistributor.veSupply(firstWeek);
      const firstWeekITokenSupply = await govFeeDistributor.iTokenSupply(
        firstWeek
      );

      const secondWeekVeSupply = await govFeeDistributor.veSupply(secondWeek);
      const secondWeekITokenSupply = await govFeeDistributor.iTokenSupply(
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

      await expect(
        govFeeDistributor.connect(alice)["claim(address)"](bob.address)
      ).to.changeTokenBalance(iToken, bob, expectITokenReceive);
    });
  });

  describe("claimMany", () => {});
  describe("killMe", () => {});
  describe("burn", () => {});
});
