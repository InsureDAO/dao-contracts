const hre = require("hardhat");
const { ethers } = require("hardhat");
const { BigNumber } = require('ethers');

/***
 * Before the launch, make sure that
 * - BOOST_WARMUP = 0;
 * - INFLATION_DELAY > now - (Wed 12pm UTC)
 */

async function main() {
  await hre.run('compile');

  //addresses
  const {
    USDCAddress,
    RegistryAddress,
    Market1,
    Market2,
    Market3,
    CDSAddress,
    IndexAddress,
  } = require("./deployments.js");

  const [deployer] = await ethers.getSigners();


  // We get the contract to deploy
  const PoolProxy = await hre.ethers.getContractFactory("PoolProxy");

  const POOL_PROXY_ADMINS = {
      "Ownership": deployer.address,
      "Params": deployer.address,
      "Emergency": deployer.address 
  }

  //===deploy start===
  //InsureToken
  const pool_proxy = await PoolProxy.deploy(
    POOL_PROXY_ADMINS['Ownership'], 
    POOL_PROXY_ADMINS['Params'], 
    POOL_PROXY_ADMINS['Emergency']
  );
  console.log("PoolProxy deployed to:", pool_proxy.address);


}

main()
    .then(() => process.exit(0))
    .catch(error => {
    console.error(error);
    process.exit(1);
    });