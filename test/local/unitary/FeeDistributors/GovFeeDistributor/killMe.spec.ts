import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { govFeeDistributorDeploy } from "../../../../utils/fixtures/GovFeeDistributorDeploy";

describe("killMe", () => {
  it("should killed distributor", async () => {
    const {
      govFeeDistributor,
      alice,
      usdc,
      reservePool: iToken,
    } = await loadFixture(govFeeDistributorDeploy);

    await expect(govFeeDistributor.isKilled()).to.eventually.false;

    // deposit half of the usdc into reserve pool
    await govFeeDistributor["depositBalanceToReserve(uint256)"](
      (await usdc.balanceOf(govFeeDistributor.address)).div(2)
    );

    const usdcBalance = await usdc.balanceOf(govFeeDistributor.address);
    const iTokenBalance = await iToken.balanceOf(govFeeDistributor.address);

    // transfer all usdc and iToken to alice
    await expect(govFeeDistributor.killMe(alice.address))
      .changeTokenBalances(
        usdc,
        [govFeeDistributor, alice],
        [usdcBalance.mul(-1), usdcBalance]
      )
      .changeTokenBalances(
        iToken,
        [govFeeDistributor.address, alice.address],
        [iTokenBalance.mul(-1), iTokenBalance]
      );

    // distributor now killed
    await expect(govFeeDistributor.isKilled()).to.eventually.true;
  });
});
