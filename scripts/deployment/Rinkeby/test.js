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
  console.log("deployer: ", deployer.address);


  const A = 1_000_000;
  const B = 1;


}

main()
    .then(() => process.exit(0))
    .catch(error => {
    console.error(error);
    process.exit(1);
    });