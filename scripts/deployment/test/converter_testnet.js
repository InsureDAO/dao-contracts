const hre = require("hardhat");
const { ethers } = require("hardhat");
const { BigNumber } = require('ethers');

/***
 * Before the launch, make sure that
 * - BOOST_WARMUP = 0;
 * - INFLATION_DELAY > now - (Wed 12pm UTC)
 */

/***
 * For testnet, only the basic contracts will be deployed.
 * No vesting and admin management.
 */

async function main() {
    await hre.run('compile');

    const [deployer] = await ethers.getSigners();


    // We get the contract to deploy
    const TestToken = await hre.ethers.getContractFactory("TestToken");
    const GaugeController = await hre.ethers.getContractFactory("GaugeController");
    const Minter = await hre.ethers.getContractFactory("Minter");
    const VotingEscrow = await hre.ethers.getContractFactory("VotingEscrow");
    const ConverterV1 = await hre.ethers.getContractFactory("ConverterV1");

    const ARAGON_AGENT = "0x1000000000000000000000000000000000000000";

    //config
    const name = "InsureToken";
    const simbol = "Insure";
    const decimal = 18;

    const REGISTRY_ADDRESS = "0xe73Aa421A1c6C8c7057dc5094337589db66B7f54";

    //===deploy start===
    console.log("========== Basic Deployment START ==========");
    console.log("deployer:", deployer.address);

    //InsureToken
    const token = await TestToken.deploy(name, simbol, decimal);
    await token._mint_for_testing(100);
    console.log("InsureToken deployed to:", token.address);
    
    const voting_escrow = await VotingEscrow.deploy(
        token.address,
        "Vote-escrowed INSURE",
        "veINSURE",
        "veINSURE_1.0.0"
    );
    console.log("VotingEscrow deployed to:", voting_escrow.address);
    await voting_escrow.changeController(ARAGON_AGENT);

    //GaugeController
    const gauge_controller = await GaugeController.deploy(
        token.address,
        voting_escrow.address
    );
    console.log("GaugeController deployed to:", gauge_controller.address);

    //Minter
    const minter = await Minter.deploy(token.address, gauge_controller.address, REGISTRY_ADDRESS);
    console.log("Minter deployed to:", minter.address);

    //ConverterV1
    const converter = await ConverterV1.deploy(token.address);
    console.log("ConverterV1 deployed to:", converter.address);

    console.log("========== Basic Deployment END ==========");

}

main()
    .then(() => process.exit(0))
    .catch(error => {
    console.error(error);
    process.exit(1);
    });