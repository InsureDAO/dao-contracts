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

    const insure_token_address = "0x0000000000000000000000000000000000000000";
    const voting_escrow_address = "0x0000000000000000000000000000000000000000";

    let VESTING_ADDRESSES = ["0x9c56673F8446d8B982054dAD1C19D3098dB0716A"];
    let VESTING_ALLOCATION = [BigNumber.from("1000").mul("1000000000000000000")];//1000e18

    const Community_DAO = "0x1000000000000000000000000000000000000000";
    const Reporting_DAO = "0x1000000000000000000000000000000000000000";
    const Emergency_DAO = "0x1000000000000000000000000000000000000000";

    const GAUGE_TYPES = [
        ["Liquidity", BigNumber.from("1000000000000000000")], //10**18
    ]

    const REGISTRY_ADDRESS = "0x8c8757928827B689cf885b4A43B289f362d96B1d";
    const POOL_TOKENS = [
        ["Pool1", "0xCE491D9EC50bf413FF2Ea3c4c3b906E9AD6E5BfB", 50],
        ["Pool2", "0x848baB508Bf4A9875Eee0188e764482dC6647d44", 50],
        ["Pool3", "0xA65201ef5d3b10c8f6c006cE7c15607994CCc134", 50],
        ["Index1", "0xDF7Bc0300011619Bf7C11363F99E3BF482734083", 200],
        ["CDS", "0xF64f547a4D41584ecB624Dd32fBC98c5B6c9e02D", 100]
    ]

    const FUNDING_ADMINS = [
        deployer.address,
        ZERO_ADDRESS,
        ZERO_ADDRESS,
        ZERO_ADDRESS
    ];

    //other constants
    const ten_to_the_21 = BigNumber.from("1000000000000000000000");


    //===deploy start===
    console.log("========== Deploy part two START ==========");
    console.log("deployer:", deployer.address);

    //InsureToken
    const token = await InsureToken.attach(insure_token_address);

    //VotingEscrow
    const voting_escrow = await VotingEscrow.attach(voting_escrow_address);
    await voting_escrow.changeController(Community_DAO);


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


    //set gauge_type
    for(let el in GAUGE_TYPES){
        let name = GAUGE_TYPES[el][0];
        let weight = GAUGE_TYPES[el][1];
        tx = await gauge_controller.add_type(name, weight);
        await tx.wait();
    };
    console.log("GaugeType:",(await gauge_controller.gauge_type_names(1)), "added"); //Liquidity


    //LiquidityGauge xn
    for(let el in POOL_TOKENS){ //LiquidityGauge
        let name = POOL_TOKENS[el][0];
        let lp_token = POOL_TOKENS[el][1];
        let weight = POOL_TOKENS[el][2];

        let liquidity_gauge = await LiquidityGauge.deploy(lp_token, minter.address, deployer.address);
        console.log("LiquidityGauge deployed to:", liquidity_gauge.address, "{",name, lp_token, weight,"}");
        await gauge_controller.add_gauge(liquidity_gauge.address, 1, weight);
    }

    //PoolProxy
    const pool_proxy = await PoolProxy.deploy(Community_DAO, Community_DAO, Emergency_DAO);
    console.log("PoolProxy deployed to:", pool_proxy.address);

}

main()
    .then(() => process.exit(0))
    .catch(error => {
    console.error(error);
    process.exit(1);
    });