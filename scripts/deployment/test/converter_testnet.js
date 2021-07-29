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

    //GaugeController
    const gauge_controller = await GaugeController.deploy(
        token.address,
        voting_escrow.address
    );
    console.log("GaugeController deployed to:", gauge_controller.address);

    //Minter
    const minter = await Minter.deploy(token.address, gauge_controller.address, REGISTRY_ADDRESS);
    console.log("Minter deployed to:", minter.address);
    let tx = await token.set_minter(minter.address);
    await tx.wait();
    console.log("InsureToken minter is:", await token.minter());

    const ConverterV1 = await hre.ethers.getContractFactory("ConverterV1");
    const converter = await ConverterV1.deploy(token.address);

    await minter.emergency_mint(100);

    console.log("========== Basic Deployment END ==========");

}

main()
    .then(() => process.exit(0))
    .catch(error => {
    console.error(error);
    process.exit(1);
    });