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

    //config
    const name = "InsureToken";
    const symbol = "Insure";
    const decimal = 18;

    const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

    let VESTING_ADDRESSES = ["0x9c56673F8446d8B982054dAD1C19D3098dB0716A"];
    let VESTING_ALLOCATION = [BigNumber.from("1000").mul("1000000000000000000")];//1000e18
    const ARAGON_AGENT = "0x1000000000000000000000000000000000000000";

    const GAUGE_TYPES = [
        ["Liquidity", BigNumber.from("1000000000000000000")], //10**18
    ]

    const REGISTRY_ADDRESS = "0xFea62Ce96A463aE088D3DE98Eb010ccE7DB88fD2";
    const POOL_TOKENS = [
        ["Pool1", "0x1Ec3bbEe545bD477FAb710Fc08696819C9Fe23F8", 50],
        ["Pool2", "0x8c2947E5Fbe0FD1D106C49bAF49fA1f086239638", 50],
        ["Pool3", "0xf18B518E4346Bd0A9b2408fa762eCf801dAFb252", 50],
        ["Index1", "0x5483460a9eE87EDb1AaFee79F400343505C149e1", 200],
        ["CDS", "0xF509e13B7d7bb915D3057ea8B7BE576708fcEa07", 100]
    ]

    const POOL_PROXY_ADMINS = {
        "Ownership": deployer.address,
        "Params": deployer.address,
        "Emergency": deployer.address 
    }

    const FUNDING_ADMINS = [
        deployer.address,
        ZERO_ADDRESS,
        ZERO_ADDRESS,
        ZERO_ADDRESS
    ];

    //other constants
    const ten_to_the_21 = BigNumber.from("1000000000000000000000");


    //===deploy start===
    console.log("========== Basic Deployment START ==========");
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
    console.log((await gauge_controller.gauge_type_names(1))); //Liquidity

    //LiquidityGauge x5
    for(let el in POOL_TOKENS){ //LiquidityGauge
        let name = POOL_TOKENS[el][0];
        let lp_token = POOL_TOKENS[el][1];
        let weight = POOL_TOKENS[el][2];

        let liquidity_gauge = await LiquidityGauge.deploy(lp_token, minter.address, deployer.address);
        console.log("LiquidityGauge deployed to:", liquidity_gauge.address, "{",name, lp_token, weight,"}");
        await gauge_controller.add_gauge(liquidity_gauge.address, 1, weight);
    }

    console.log("========== Basic Deployment END ==========");

}

main()
    .then(() => process.exit(0))
    .catch(error => {
    console.error(error);
    process.exit(1);
    });