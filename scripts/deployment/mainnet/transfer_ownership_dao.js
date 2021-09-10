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
    const InsureToken = await hre.ethers.getContractFactory("InsureToken");
    const VotingEscrow = await hre.ethers.getContractFactory("VotingEscrow");
    const GaugeController = await hre.ethers.getContractFactory("GaugeController");
    const Minter = await hre.ethers.getContractFactory("Minter");
    const LiquidityGauge = await hre.ethers.getContractFactory("LiquidityGauge");
    const PoolProxy = await hre.ethers.getContractFactory("PoolProxy");


    const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

    const it_address = "0x0000000000000000000000000000000000000000";
    const gc_address = "";
    const ve_address = "";
    const pp_address = "";


    const Community_DAO = "0x1000000000000000000000000000000000000000";
    const Reporting_DAO = "0x1000000000000000000000000000000000000000";
    const Emergency_DAO = "0x1000000000000000000000000000000000000000";



    //start
    console.log("deployer:", deployer.address);

    //attaching
    const gauge_controller = await GaugeController.attach(gc_address);
    const voting_escrow = await VotingEscrow.attach(ve_address);
    const pool_proxy = await PoolProxy.attach(pp_address);
    const insure_token = await InsureToken.attach(it_address);

    gauge_controller.commit_transfer_ownership(Community_DAO);
    gauge_controller.apply_transfer_ownership();
    
    voting_escrow.commit_transfer_ownership(Community_DAO);
    voting_escrow.apply_transfer_ownership();

    //pool_proxy: set_reporting_dafault
}

main()
    .then(() => process.exit(0))
    .catch(error => {
    console.error(error);
    process.exit(1);
    });