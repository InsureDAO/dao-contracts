import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { govFeeDistributorDeploy } from "../../../../utils/fixtures/GovFeeDistributorDeploy";

describe("depositBalanceToReserve", () => {
  it("should deposit all usdc admin fee into reserve pool", async () => {
    const { govFeeDistributor, reservePool } = await loadFixture(
      govFeeDistributorDeploy
    );

    await expect(
      reservePool.balanceOf(govFeeDistributor.address)
    ).to.eventually.eq(0);
    await expect(govFeeDistributor.lastITokenBalance()).to.eventually.eq(0);

    await govFeeDistributor["depositBalanceToReserve()"]();

    await expect(
      reservePool.balanceOf(govFeeDistributor.address)
    ).to.eventually.gt(0);
    await expect(govFeeDistributor.lastITokenBalance()).to.eventually.eq(0);
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
