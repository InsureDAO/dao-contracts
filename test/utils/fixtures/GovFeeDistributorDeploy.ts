import { ethers } from "hardhat";
import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";

import { BigNumber, constants } from "ethers";

import {
  BondingPremium__factory,
  CDSTemplate__factory,
  Factory__factory,
  Parameters__factory,
  PoolTemplate__factory,
  Registry__factory,
  Vault__factory,
} from "../../../typechain-types";

import registryJson from "@insuredao/pool-contracts/artifacts/contracts/Registry.sol/Registry.json";
import parametersJson from "@insuredao/pool-contracts/artifacts/contracts/Parameters.sol/Parameters.json";
import factoryJson from "@insuredao/pool-contracts/artifacts/contracts/Factory.sol/Factory.json";
import vaultJson from "@insuredao/pool-contracts/artifacts/contracts/Vault.sol/Vault.json";
import cdsJson from "@insuredao/pool-contracts/artifacts/contracts/CDSTemplate.sol/CDSTemplate.json";
import poolJson from "@insuredao/pool-contracts/artifacts/contracts/PoolTemplate.sol/PoolTemplate.json";
import premiumModelJson from "@insuredao/pool-contracts/artifacts/contracts/PremiumModels/BondingPremium.sol/BondingPremium.json";
import { assert } from "chai";

// FIXME: define global constants
const DAY = BigNumber.from(86_400);
const WEEK = BigNumber.from(86_400 * 7);
const YEAR = BigNumber.from(86_400 * 365);

const GOVERNANCE_FEE_RATE = 1e5;

export const govFeeDistributorDeploy = async () => {
  const now = await time.latest();
  const GovFeeDistributor = await ethers.getContractFactory(
    "GovFeeDistributor"
  );

  const {
    vault,
    votingEscrow,
    ownership,
    reservePool,
    insureToken,
    usdc,
    deployer,
    alice,
    bob,
    charlie,
  } = await baseContractsDeploy();

  // deploy GovFeeDistributor
  const govFeeDistributor = await GovFeeDistributor.deploy(
    vault.address,
    votingEscrow.address,
    ownership.address,
    reservePool.address,
    usdc.address,
    now
  );

  // lock insure token
  await insureToken
    .connect(alice)
    .approve(votingEscrow.address, constants.MaxUint256);
  await insureToken
    .connect(bob)
    .approve(votingEscrow.address, constants.MaxUint256);
  const fourYearsLater = now + 4 * YEAR.toNumber();
  await votingEscrow
    .connect(alice)
    .create_lock(10_000_000n * 10n ** 18n, fourYearsLater);
  await votingEscrow
    .connect(bob)
    .create_lock(10_000_000n * 10n ** 18n, fourYearsLater);

  // transfer admin fee to FeeDistributor
  await vault.withdrawAllAttribution(govFeeDistributor.address);

  return {
    deployer,
    alice,
    bob,
    charlie,
    usdc,
    govFeeDistributor,
    votingEscrow,
    reservePool,
  };
};

export const govFeeDistributorWithRunningVotingEscrow = async () => {
  const now = await time.latest();
  const GovFeeDistributor = await ethers.getContractFactory(
    "GovFeeDistributor"
  );

  const {
    vault,
    votingEscrow,
    ownership,
    reservePool,
    insureToken,
    usdc,
    deployer,
    alice,
    bob,
  } = await baseContractsDeploy();

  // lock insure token
  await insureToken
    .connect(alice)
    .approve(votingEscrow.address, constants.MaxUint256);
  await insureToken
    .connect(bob)
    .approve(votingEscrow.address, constants.MaxUint256);
  const fourYearsLater = now + 4 * YEAR.toNumber();
  await votingEscrow
    .connect(alice)
    .create_lock(10_000_000n * 10n ** 18n, fourYearsLater);
  await votingEscrow
    .connect(bob)
    .create_lock(10_000_000n * 10n ** 18n, fourYearsLater);

  // 2 week passed, then deploy fee distributor
  await time.increase(WEEK.mul(2));

  // increase lock amount of INSURE
  await votingEscrow.connect(alice).increase_amount(20_000_000n * 10n ** 18n);
  await votingEscrow.connect(bob).increase_amount(20_000_000n * 10n ** 18n);

  const twoWeeksLater = await time.latest();

  // deploy GovFeeDistributor
  const govFeeDistributor = await GovFeeDistributor.deploy(
    vault.address,
    votingEscrow.address,
    ownership.address,
    reservePool.address,
    usdc.address,
    twoWeeksLater
  );

  // transfer admin fee to FeeDistributor
  await vault.withdrawAllAttribution(govFeeDistributor.address);

  return {
    deployer,
    alice,
    bob,
    usdc,
    govFeeDistributor,
    votingEscrow,
    reservePool,
  };
};

export const govFeeDistributorDeployAfterLock = async () => {
  const now = await time.latest();
  const GovFeeDistributor = await ethers.getContractFactory(
    "GovFeeDistributor"
  );

  const {
    vault,
    votingEscrow,
    ownership,
    reservePool,
    insureToken,
    usdc,
    deployer,
    alice,
    bob,
    charlie,
  } = await baseContractsDeploy();

  // lock insure token
  await insureToken
    .connect(alice)
    .approve(votingEscrow.address, constants.MaxUint256);
  await insureToken
    .connect(bob)
    .approve(votingEscrow.address, constants.MaxUint256);
  const fourYearsLater = now + 4 * YEAR.toNumber();
  await votingEscrow
    .connect(alice)
    .create_lock(10_000_000n * 10n ** 18n, fourYearsLater);
  await votingEscrow
    .connect(bob)
    .create_lock(10_000_000n * 10n ** 18n, fourYearsLater);

  // 1 week passed
  await time.increase(WEEK);

  // deploy GovFeeDistributor
  const govFeeDistributor = await GovFeeDistributor.deploy(
    vault.address,
    votingEscrow.address,
    ownership.address,
    reservePool.address,
    usdc.address,
    WEEK.add(now)
  );

  // transfer admin fee to FeeDistributor
  await vault.withdrawAllAttribution(govFeeDistributor.address);

  return {
    deployer,
    alice,
    bob,
    charlie,
    usdc,
    govFeeDistributor,
    votingEscrow,
    reservePool,
  };
};

const baseContractsDeploy = async () => {
  const [deployer, alice, bob, charlie] = await ethers.getSigners();
  // dao contracts
  const MintableERC20 = await ethers.getContractFactory("MintableERC20");
  const Ownership = await ethers.getContractFactory("Ownership");
  const InsureToken = await ethers.getContractFactory("InsureToken");
  const VotingEscrow = await ethers.getContractFactory("VotingEscrow");
  // pool contracts
  const Registry = (await ethers.getContractFactoryFromArtifact(
    registryJson
  )) as Registry__factory;

  const Parameters = (await ethers.getContractFactoryFromArtifact(
    parametersJson
  )) as Parameters__factory;
  const Factory = (await ethers.getContractFactoryFromArtifact(
    factoryJson
  )) as Factory__factory;
  const Vault = (await ethers.getContractFactoryFromArtifact(
    vaultJson
  )) as Vault__factory;
  const CDSTemplate = (await ethers.getContractFactoryFromArtifact(
    cdsJson
  )) as CDSTemplate__factory;
  const PoolTemplate = (await ethers.getContractFactoryFromArtifact(
    poolJson
  )) as PoolTemplate__factory;
  const PremiumModel = (await ethers.getContractFactoryFromArtifact(
    premiumModelJson
  )) as BondingPremium__factory;

  const usdc = await MintableERC20.deploy("USD Coin", "USDC");
  const ownership = await Ownership.deploy();
  const insureToken = await InsureToken.deploy(
    "InsureToken",
    "INSURE",
    ownership.address
  );
  const registry = await Registry.deploy(ownership.address);
  const parameters = await Parameters.deploy(ownership.address);
  const factory = await Factory.deploy(registry.address, ownership.address);
  const vault = await Vault.deploy(
    usdc.address,
    registry.address,
    constants.AddressZero,
    ownership.address
  );
  const premium = await PremiumModel.deploy(ownership.address);

  const votingEscrow = await VotingEscrow.deploy(
    insureToken.address,
    "Voting-escrowed Insure",
    "veInsure",
    "veInsure",
    ownership.address
  );

  const cdsTemplate = await CDSTemplate.deploy();
  const poolTemplate = await PoolTemplate.deploy();

  // registry configuration
  await registry.setFactory(factory.address);

  // factory configuration
  // reserve pool template
  await factory.approveTemplate(cdsTemplate.address, true, true, true);
  await factory.approveReference(cdsTemplate.address, 0, usdc.address, true);
  await factory.approveReference(
    cdsTemplate.address,
    1,
    registry.address,
    true
  );
  await factory.approveReference(
    cdsTemplate.address,
    2,
    parameters.address,
    true
  );

  // market template
  await factory.approveTemplate(poolTemplate.address, true, true, true);
  await factory.approveReference(
    poolTemplate.address,
    0,
    insureToken.address,
    true
  );
  await factory.approveReference(poolTemplate.address, 1, usdc.address, true);
  await factory.approveReference(
    poolTemplate.address,
    2,
    registry.address,
    true
  );
  await factory.approveReference(
    poolTemplate.address,
    3,
    parameters.address,
    true
  );

  //set default parameters
  await parameters.setFeeRate(constants.AddressZero, GOVERNANCE_FEE_RATE);
  await parameters.setGrace(constants.AddressZero, DAY.mul("3"));
  await parameters.setLockup(constants.AddressZero, WEEK);
  await parameters.setWithdrawable(constants.AddressZero, WEEK.mul(2));
  await parameters.setMinDate(constants.AddressZero, WEEK);
  await parameters.setPremiumModel(constants.AddressZero, premium.address);
  await parameters.setVault(usdc.address, vault.address);
  await parameters.setMaxList(constants.AddressZero, "10");

  // market creation
  const createReservePool = await factory.createMarket(
    cdsTemplate.address,
    "0x",
    [0, 0],
    [usdc.address, registry.address, parameters.address]
  );
  const reservePoolCreated = await createReservePool.wait();
  const reservePoolCreatedEvent = reservePoolCreated.events?.find(
    (event) => event.event === "MarketCreated"
  );
  const [reservePoolAddress] = reservePoolCreatedEvent?.args as string[];
  const reservePool = CDSTemplate.attach(reservePoolAddress);

  const createMarket = await factory.createMarket(
    poolTemplate.address,
    "0x",
    [0, 0],
    [insureToken.address, usdc.address, registry.address, parameters.address]
  );
  const marketCreated = await createMarket.wait();
  const marketCreatedEvent = marketCreated.events?.find(
    (event) => event.event === "MarketCreated"
  );
  const [marketAddress] = marketCreatedEvent?.args as string[];
  const market = PoolTemplate.attach(marketAddress);

  // initial supply = 126M INSURE
  await assert.eventually.equal(
    insureToken.balanceOf(deployer.address),
    126_000_000n * 10n ** 18n
  );

  // transfer INSURE to accounts
  await insureToken.transfer(alice.address, 50_000_000n * 10n ** 18n);
  await insureToken.transfer(bob.address, 50_000_000n * 10n ** 18n);

  // mint usdc to accounts
  await usdc.mint(deployer.address, 10_000_000n * 10n ** 6n);
  await usdc.mint(alice.address, 10_000_000n * 10n ** 6n);
  await usdc.mint(bob.address, 10_000_000n * 10n ** 6n);

  // initial deposit into market
  await usdc.approve(vault.address, constants.MaxUint256);
  await market.deposit(10_000_000n * 10n ** 6n);

  // got insured
  await usdc.connect(alice).approve(vault.address, constants.MaxUint256);
  await market
    .connect(alice)
    .insure(
      1_000_000n * 10n ** 6n,
      1_000_000n * 10n ** 6n,
      WEEK.mul(3),
      constants.HashZero,
      alice.address,
      alice.address
    );

  return {
    deployer,
    alice,
    bob,
    charlie,
    usdc,
    ownership,
    insureToken,
    votingEscrow,
    reservePool,
    market,
    vault,
  };
};
