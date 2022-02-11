const hre = require("hardhat");
const { ethers } = require("hardhat");
const { BigNumber } = require('ethers');
const fs = require("fs");

/***
 * Before the launch, make sure that
 * - BOOST_WARMUP = 0;
 * - INFLATION_DELAY > now - (Wed 12pm UTC)
 */

/***
 *  deploy PoolProxy and transfer dao ownership
 */

async function main() {
  await hre.run('compile');

  const [deployer] = await ethers.getSigners();

  const {
    USDCAddress,
    OwnershipAddress,
    GovOwnershipAddress,
    RegistryAddress,
    FactoryAddress,
    PremiumModelAddress,
    ParametersAddress,
    VaultAddress,
    PoolTemplateAddress,
    IndexTemplateAddress,
    CDSTemplateAddress,
    Market1,
    Market2,
    Market3,
    Index,
    CDS,
  } = require("./deployments.js");

  const {
    DAOAddress,
    ReportingAddress,
    POOL_PROXY_ADMINS,
  } = require("./config.js");


  // We get the contract to deploy
  const Ownership = await ethers.getContractFactory("Ownership");
  const PoolProxy = await hre.ethers.getContractFactory("PoolProxy");

  //===deploy start===
  //PoolProxy
  const pool_proxy = await PoolProxy.deploy(
    deployer.address,
    deployer.address,
    deployer.address
  ); //PoolProxy => Deployer
  console.log("PoolProxy deployed to:", pool_proxy.address)

  await pool_proxy.commit_set_default_reporting_admin(ReportingAddress) //Reporting Default

  //===transfer ownership start===
  const ownership = await Ownership.attach(OwnershipAddress);
  const govOwnership = await Ownership.attach(GovOwnershipAddress);

  await ownership.commitTransferOwnership(pool_proxy.address); //Pool => PoolProxy
  //await govOwnership.commitTransferOwnership(DAOAddress); //DAO => Gnosis


  /**
  await pool_proxy.commit_set_admins(
    POOL_PROXY_ADMINS['Ownership'], 
    POOL_PROXY_ADMINS['Params'], 
    POOL_PROXY_ADMINS['Emergency']
  )
   */
  //PoolProxy => Gnosis



/*** TODO
 * - ReportingDAO => accept
 * - Gnosis wallet => accept on PoolProxy, govOwnership
 */
}

main()
    .then(() => process.exit(0))
    .catch(error => {
    console.error(error);
    process.exit(1);
    });