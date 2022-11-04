import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { govFeeDistributorDeploy } from "../../../../utils/fixtures/GovFeeDistributorDeploy";

describe("burn", () => {
  it("should burn iToken of msg sender", async () => {
    const { govFeeDistributor, reservePool, usdc, alice } = await loadFixture(
      govFeeDistributorDeploy
    );

    // deposit usdc then receive iToken
    await reservePool
      .connect(alice)
      .deposit((await usdc.balanceOf(alice.address)).div(2));

    const aliceITokenBalance = await reservePool.balanceOf(alice.address);

    expect(aliceITokenBalance).not.to.eq(0);

    await reservePool
      .connect(alice)
      .approve(govFeeDistributor.address, aliceITokenBalance);

    // all alice iToken should be sent to govFeeDistributor
    await expect(govFeeDistributor.connect(alice).burn()).changeTokenBalances(
      reservePool,
      [alice, govFeeDistributor],
      [aliceITokenBalance.mul(-1), aliceITokenBalance]
    );
  });

  it("cannot be burnt using killed distributor", async () => {
    const { govFeeDistributor, reservePool, usdc, alice } = await loadFixture(
      govFeeDistributorDeploy
    );

    await govFeeDistributor.killMe(alice.address);

    await reservePool
      .connect(alice)
      .deposit(await usdc.balanceOf(alice.address));

    await expect(
      govFeeDistributor.connect(alice).burn()
    ).to.be.revertedWithCustomError(govFeeDistributor, "ContractUnavailable");
  });
});
