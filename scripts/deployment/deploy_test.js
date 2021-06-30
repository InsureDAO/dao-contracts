// We require the Hardhat Runtime Environment explicitly here. This is optional 
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
const hre = require("hardhat");
const { ethers } = require("hardhat");
const { BigNumber } = require('ethers');

async function main() {
    // Hardhat always runs the compile task when running scripts with its command
    // line interface.
    //
    // If this script is run directly using `node` you may want to call compile 
    // manually to make sure everything is compiled
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
    const simbol = "Insure";
    const decimal = 18;

    const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

    const REGISTRY_ADDRESS = "0x0000000000000000000000000000000000000000";
    let VESTING_ADDRESSES = ["0x9c56673F8446d8B982054dAD1C19D3098dB0716A"];
    let VESTING_ALLOCATION = [BigNumber.from("1000").mul("1000000000000000000")];//1000e18
    const ARAGON_AGENT = "0x1000000000000000000000000000000000000000";

    const GAUGE_TYPES = [
        ["Liquidity", BigNumber.from("1000000000000000000")], //10**18
    ]

    const POOL_TOKENS = [
        ["Pool1", ZERO_ADDRESS , 12],
        ["Pool2", ZERO_ADDRESS , 24],
        ["Index1", ZERO_ADDRESS, 100],
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

    //TEST POOLS
    const TestLP = await hre.ethers.getContractFactory("TestLP");
    for(let i=0; i<3; i++){
        let mock_lp_token = await TestLP.deploy("InsureDAO LP token", "indexSURE", decimal, ten_to_the_21);
        POOL_TOKENS[i][1] = mock_lp_token.address;
    }

    //InsureToken
    const token = await InsureToken.deploy(name, simbol, decimal);
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
    await token.set_minter(minter.address);
    console.log("InsureToken minter is:", await token.minter());

    //set gauge_type
    await GAUGE_TYPES.forEach(el => {
        let name = el[0];
        let weight = el[1];
        gauge_controller.add_type(name, weight);
    });
    console.log((await gauge_controller.gauge_type_names(1))); //Liquidity

    //LiquidityGauge x3
    for(let el in POOL_TOKENS){ //LiquidityGauge
        let name = POOL_TOKENS[el][0];
        let lp_token = POOL_TOKENS[el][1];
        let weight = POOL_TOKENS[el][2];

        let liquidity_gauge = await LiquidityGauge.deploy(lp_token, minter.address, deployer.address);
        console.log("LiquidityGauge deployed to:", liquidity_gauge.address, "{",name, lp_token, weight,"}");
        await gauge_controller.add_gauge(liquidity_gauge.address, 1, weight);
    }

    //change ownership
    /**
    await gauge_controller.commit_transfer_ownership(ARAGON_AGENT);
    await gauge_controller.apply_transfer_ownership();
    await voting_escrow.commit_transfer_ownership(ARAGON_AGENT);
    await voting_escrow.apply_transfer_ownership();
    */

    console.log("========== Basic Deployment END ==========");
    console.log("========== Additional Deployment START ==========");


    //Poolproxy
    const PoolProxy = await hre.ethers.getContractFactory("PoolProxy");
    const pool_proxy = await PoolProxy.deploy(POOL_PROXY_ADMINS["Ownership"], POOL_PROXY_ADMINS["Params"], POOL_PROXY_ADMINS["Emergency"]);
    console.log("PoolProxy deployed to:", pool_proxy.address);
    console.log("  Ownership:", POOL_PROXY_ADMINS["Ownership"]);
    console.log("  Params:", POOL_PROXY_ADMINS["Params"]);
    console.log("  Emergency:", POOL_PROXY_ADMINS["Emergency"]);


    //VestingEscrow
    const VestingEscrow = await hre.ethers.getContractFactory("VestingEscrow");
    let now = (await ethers.provider.getBlock('latest')).timestamp;
    let start_time = now + 300;
    let end_time = 1628364267;
    const vesting_escrow = await VestingEscrow.deploy(
        token.address, //token
        start_time, //start_time
        end_time, //end_time
        false, //can_disable
        FUNDING_ADMINS
    );
    console.log("VestingEscrow deployed to:", vesting_escrow.address);
    console.log("  Vesting Token:", token.address);
    console.log("  Start:", start_time);
    console.log("  End:", end_time);
    console.log("  duration:", end_time - start_time, ", about", (end_time - start_time)/86400, "days");

    
    //vesting
    for(i=VESTING_ADDRESSES.length; i<100; i++){
        VESTING_ADDRESSES.push(ZERO_ADDRESS);
    }
    for(i=VESTING_ALLOCATION.length; i<100; i++){
        VESTING_ALLOCATION.push(0);
    }
    await token.approve(vesting_escrow.address, ten_to_the_21);
    await vesting_escrow.add_tokens(ten_to_the_21);
    await vesting_escrow.fund(
        VESTING_ADDRESSES,
        VESTING_ALLOCATION
    );
    
    

}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
    .then(() => process.exit(0))
    .catch(error => {
    console.error(error);
    process.exit(1);
    });