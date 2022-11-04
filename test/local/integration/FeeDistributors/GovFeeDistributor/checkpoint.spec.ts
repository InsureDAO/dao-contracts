import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";
import { BigNumber } from "ethers";

import { expect } from "chai";
import { govFeeDistributorDeploy } from "../../../../utils/fixtures/GovFeeDistributorDeploy";

const WEEK = BigNumber.from(86_400 * 7);

describe("checkpoint methods", () => {
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
});
