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

  //addresses
  const {
    USDCAddress,
    OwnershipAddress,
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
    ReportingAddress
  } = require("./constants.js");

  const [deployer] = await ethers.getSigners();


  // We get the contract to deploy
  const PoolProxy = await hre.ethers.getContractFactory("PoolProxy");

  const POOL_PROXY_ADMINS = {
      "Ownership": DAOAddress,
      "Params": DAOAddress,
      "Emergency": DAOAddress
  }

  //===deploy start===
  //InsureToken
  const pool_proxy = await PoolProxy.deploy(
    POOL_PROXY_ADMINS['Ownership'], 
    POOL_PROXY_ADMINS['Params'], 
    POOL_PROXY_ADMINS['Emergency']
  );
  console.log("PoolProxy deployed to:", pool_proxy.address)

  await pool_proxy.commit_set_default_reporting_admin(ReportingAddress)
  //need to accept by ReportingAddress

}

main()
    .then(() => process.exit(0))
    .catch(error => {
    console.error(error);
    process.exit(1);
    });