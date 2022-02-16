const hre = require("hardhat");
const { ethers } = require("hardhat");
const { BigNumber } = require('ethers');

/***
 * Before deploy, make sure
 * - BOOST_WARMUP;
 * - INFLATION_DELAY
 */

async function main() {
    await hre.run('compile');

    const [deployer] = await ethers.getSigners();


    // We get the contract to deploy
    const InsureToken = await hre.ethers.getContractFactory("InsureToken");
    const VotingEscrow = await hre.ethers.getContractFactory("VotingEscrow");

    //config
    const name = "InsureToken";
    const symbol = "Insure";
    const decimal = 18;

    const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";




    //===deploy start===
    console.log("========== Deploy part one START ==========");
    console.log("deployer:", deployer.address);

    //InsureToken
    const token = await InsureToken.deploy(name, symbol, decimal);
    console.log("InsureToken deployed to:", token.address);

    //VotingEscrow
    const voting_escrow = await VotingEscrow.deploy(
        token.address,
        "Vote-escrowed INSURE",
        "veINSURE",
        "veINSURE_1.0.0"
    );
    console.log("VotingEscrow deployed to:", voting_escrow.address);


    console.log("========== Deploy part one END ==========");

}

main()
    .then(() => process.exit(0))
    .catch(error => {
    console.error(error);
    process.exit(1);
    });