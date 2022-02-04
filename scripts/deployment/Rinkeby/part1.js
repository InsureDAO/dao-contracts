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
 * This script does
 *  - deploy 
 *    - Token, Gauges, VotingEscrow
 * not deploy 
 *  - Vesting
 *  - PoolProxy
 */

async function main() {
  await hre.run('compile');

  //addresses
  const {
    USDCAddress,
    OwnershipAddress,
    RegistryAddress,
    FactoryAddress,
    PremiumModelAddress,
    ParametersAddress,
    VaultAddress,
    PoolTemplateAddress,
    IndexTemplateAddress,
    CDSTemplateAddress,
    Market1,
    Market2,
    Market3,
    Index,
    CDS,
  } = require("./deployments.js");

  const [deployer] = await ethers.getSigners();


  // We get the contract to deploy
  const Ownership = await hre.ethers.getContractFactory("Ownership");
  const InsureToken = await hre.ethers.getContractFactory("InsureToken");
  const VotingEscrow = await hre.ethers.getContractFactory("VotingEscrow");
  const GaugeController = await hre.ethers.getContractFactory("GaugeController");
  const Minter = await hre.ethers.getContractFactory("Minter");
  const LiquidityGauge = await hre.ethers.getContractFactory("LiquidityGauge");

  //config
  const name = "InsureToken";
  const symbol = "INSURE";

  const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

  let VESTING_ADDRESSES = ["0x9c56673F8446d8B982054dAD1C19D3098dB0716A"];
  let VESTING_ALLOCATION = [BigNumber.from("1000").mul("1000000000000000000")];//1000e18
  const ARAGON_AGENT = "0x1000000000000000000000000000000000000000";

  const GAUGE_TYPES = [
      ["Liquidity", BigNumber.from("1000000000000000000")], //10**18
  ]

  const POOL_TOKENS = [
    ["Pool1", Market1, 50],
    ["Pool2", Market2, 50],
    ["Pool3", Market3, 50],
    ["Index1", Index, 200],
    ["CDS", CDS, 100]
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

  //===deploy start===
  console.log("========== Basic Deployment START ==========");
  console.log("deployer:", deployer.address);

  //Ownership
  const ownership = await Ownership.deploy();
  console.log("Ownership deployed to:", ownership.address);

  //InsureToken
  const token = await InsureToken.deploy(name, symbol);
  console.log("InsureToken deployed to:", token.address);


  //VotingEscrow
  const voting_escrow = await VotingEscrow.deploy(
      token.address,
      "Vote-escrowed INSURE",
      "veINSURE",
      "veINSURE_1.0.0",
      ownership.address
  );
  console.log("VotingEscrow deployed to:", voting_escrow.address);


  //GaugeController
  const gauge_controller = await GaugeController.deploy(
      token.address,
      voting_escrow.address,
      ownership.address
  );
  console.log("GaugeController deployed to:", gauge_controller.address);


  //Minter
  const minter = await Minter.deploy(
    token.address,
    gauge_controller.address,
    ownership.address
  );
  console.log("Minter deployed to:", minter.address);

  //setup
  let tx = await token.set_minter(minter.address);
  await tx.wait();

  //set Gauge type 1 == Liquidity
  for(let el in GAUGE_TYPES){
      let name = GAUGE_TYPES[el][0];
      let weight = GAUGE_TYPES[el][1];
      tx = await gauge_controller.add_type(name, weight);
      await tx.wait();
  };

  //LiquidityGauge x5 for pools
  for(let el in POOL_TOKENS){
      let name = POOL_TOKENS[el][0];
      let lp_token = POOL_TOKENS[el][1];
      let weight = POOL_TOKENS[el][2];
      let liquidity_gauge = await LiquidityGauge.deploy(lp_token, minter.address, ownership.address);

      await gauge_controller.add_gauge(liquidity_gauge.address, 1, weight);

      console.log("LiquidityGauge deployed to:", liquidity_gauge.address, "{",name, lp_token, weight,"}");
      POOL_TOKENS[el].push(liquidity_gauge.address)
  }

  console.log("========== Basic Deployment END ==========");

  //write deployments.js
  let text = 
    `
    const USDCAddress = "${USDCAddress}" 
    const OwnershipAddress = "${OwnershipAddress}"  
    const RegistryAddress = "${RegistryAddress}"  
    const FactoryAddress = "${FactoryAddress}"  
    const PremiumModelAddress = "${PremiumModelAddress}"  
    const ParametersAddress = "${ParametersAddress}"  
    const VaultAddress = "${VaultAddress}"

    const PoolTemplateAddress = "${PoolTemplateAddress}" 
    const IndexTemplateAddress = "${IndexTemplateAddress}"  
    const CDSTemplateAddress = "${CDSTemplateAddress}"

    const Market1 = "${Market1}"
    const Market2 = "${Market2}" 
    const Market3 = "${Market3}" 
    const Index = "${Index}"
    const CDS = "${CDS}" 

    //DAO contracts
    const LiquidityGauges = {
      //market: gauge
      '${POOL_TOKENS[0][1]}': '${POOL_TOKENS[0][3]}',
      '${POOL_TOKENS[1][1]}': '${POOL_TOKENS[1][3]}',
      '${POOL_TOKENS[2][1]}': '${POOL_TOKENS[2][3]}',
      '${POOL_TOKENS[3][1]}': '${POOL_TOKENS[3][3]}',
      '${POOL_TOKENS[4][1]}': '${POOL_TOKENS[4][3]}',
    }

    const GovOwnershipAddress = "${ownership.address}"  
    const InsureToken = "${token.address}" 
    const VotingEscrow = "${voting_escrow.address}" 
    const GaugeController = "${gauge_controller.address}" 
    const Minter = "${minter.address}" 


    Object.assign(exports, {
      USDCAddress,
      OwnershipAddress,
      GovOwnershipAddress,
      RegistryAddress,
      FactoryAddress,
      PremiumModelAddress,
      ParametersAddress,
      VaultAddress,
      PoolTemplateAddress,
      IndexTemplateAddress,
      CDSTemplateAddress,
      Market1,
      Market2,
      Market3,
      Index,
      CDS,
    })
    `
  try {
    fs.writeFileSync("./scripts/deployment/Rinkeby/deployments.js", text);
    console.log('write end');
  }catch(e){
    console.log(e);
  }
}

main()
    .then(() => process.exit(0))
    .catch(error => {
    console.error(error);
    process.exit(1);
    });