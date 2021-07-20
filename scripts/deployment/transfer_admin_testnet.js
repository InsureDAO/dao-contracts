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

    const [deployer] = await ethers.getSigners();

    // We get the contract
    const InsureToken = await hre.ethers.getContractFactory("InsureToken");
    

}

main()
    .then(() => process.exit(0))
    .catch(error => {
    console.error(error);
    process.exit(1);
    });