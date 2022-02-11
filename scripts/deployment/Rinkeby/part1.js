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

  //----- IMPORT -----//
  const [deployer] = await ethers.getSigners();

  const {
    ZERO_ADDRESS,
    POOL_PROXY_ADMINS,
    name,
    symbol,
    GAUGE_TYPES,
  } = require("./config.js");

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
    Pools,
    Indicies,
    CDS
  } = require("./deployments.js");


  // We get the contract to deploy
  const Ownership = await hre.ethers.getContractFactory("Ownership");
  const InsureToken = await hre.ethers.getContractFactory("InsureToken");
  const VotingEscrow = await hre.ethers.getContractFactory("VotingEscrow");
  const GaugeController = await hre.ethers.getContractFactory("GaugeController");
  const Minter = await hre.ethers.getContractFactory("Minter");
  const LiquidityGauge = await hre.ethers.getContractFactory("LiquidityGauge");


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
  console.log("set minter")

  //set Gauge type 1 == Liquidity
  for(let el in GAUGE_TYPES){
      let name = GAUGE_TYPES[el][0];
      let weight = GAUGE_TYPES[el][1];
      console.log(name)
      console.log(weight)
      tx = await gauge_controller.add_type(name, weight);
      await tx.wait();
  };
  console.log("add_type")

  //LiquidityGauge for Pools
  let markets = Pools.concat(Indicies).concat(CDS)
  let POOL_TOKENS = []

  for(let i=0;i < markets.length; i++){
    let temp = [markets[i], 0]
    if(i < Pools.length){
      temp[1] = 50 //Single Pool Reward weight
    }else if(i < Pools.length + Indicies.length){
      temp[1] = 300 //Index Pool Reward weight
    }else{
      temp[1] = 150 //CDS Pool Reward weight
    }
    POOL_TOKENS.push(temp)
  }
  console.log(POOL_TOKENS)

  for(let el of POOL_TOKENS){
      let lp_token = el[0];
      let weight = el[1];
      console.log("lp_token:", lp_token)
      console.log("weight:", weight)
      let liquidity_gauge = await LiquidityGauge.deploy(lp_token, minter.address, ownership.address);

      console.log("liquidity_gauge.address:", liquidity_gauge.address)
      tx = await gauge_controller.add_gauge(liquidity_gauge.address, 1, weight);
      await tx.wait()

      console.log("LiquidityGauge deployed to:", liquidity_gauge.address, "{",lp_token, weight,"}");
      el.push(liquidity_gauge.address)
  }

  console.log("========== Basic Deployment END ==========");


  //----- WRITE -----//
  let gauges = []
  for(let i=0; i<POOL_TOKENS.length; i++){
    let text = `\n       ["` + POOL_TOKENS[i][2] + `", "` + POOL_TOKENS[i][0] + `", "` + POOL_TOKENS[i][1] + `"]`
    gauges.push(text)
  }

  let pools = []
  let indicies = []
  let cds = []

  for(let i=0; i<markets.length; i++){
    let text = `\n       "` + markets[i] + `"`

    if(i < Pools.length){
      pools.push(text)
    }else if(i < Indicies.length + Pools.length){
      indicies.push(text)
    }else{
      cds.push(text)
    }
  }

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
    const Pools= [${pools}\n      ]\n
    const Indicies = [${indicies}\n      ]\n
    const CDS = [${cds}\n      ]\n

    //DAO contracts
    const LiquidityGauges = [${gauges}\n      ]\n

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
      Pools,
      Indicies,
      CDS,
      InsureToken
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