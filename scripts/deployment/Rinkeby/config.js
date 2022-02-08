const { ethers } = require("hardhat");
const { BigNumber } = require("ethers");



const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

const DEPLOYER = "0x168F8aA6d0aaeFCF75DdD3fF6793861114C035E8";
const DAOAddress = "0xEa13917C87296ADa5cCB33C9f9ed420DD17213b7"; //core team's gnosis multisig wallet address
const ReportingAddress = "";



const name = "InsureToken";
const symbol = "INSURE";

const INITIAL_SUPPLY = new BigNumber.from("126000000");
const RATE_DENOMINATOR = new BigNumber.from("1000000000000000000");//1e18

const GAUGE_TYPES = [
  ["Liquidity", BigNumber.from("1000000000000000000")], //10**18
]

const POOL_PROXY_ADMINS = {
  "Ownership": DEPLOYER,
  "Params": DEPLOYER,
  "Emergency": DEPLOYER
}










const PERCENTAGE = new BigNumber.from("1000000");//1e6;

const TEAM_AMOUNT = new BigNumber.from("42682920");
const TEAM_ADDRESSES = [
  ["0x0999033A70B936bd10582437040550eaB875Ca95", "25000"],
  ["0x93fFa47B14215692141832f37eaE16Eb02bB59a3", "3500"],
  ["0x7a14D3272bfd4742f365fe87272af227e02C4B3D", "1500"],
  ["0xa1E1822c5bEAb648C232B3e1f49959CFa80A22Ec", "1680"],
  ["0x751fF30eD064Ba16Fce4f87b3557deA6F4dECba0", "25000"],
  ["0x44F224b935D4690Cfdf244322F1dC3682F034C60", "100000"],
  ["0xD33284930474fd9CD8b09735026Eb1613c8A80A6", "25000"]
]



const INVESTOR_AMOUNT = 0;
const INVESTOR_ADDRESSES = [

]
const ADVISOR_AMOUNT = 0;
const ADVISOR_ADDRESSES = [

]

const FUND_ADMINS = [
  DEPLOYER, 
  DEPLOYER,
  DEPLOYER,
  DEPLOYER
]

Object.assign(exports, {
  ZERO_ADDRESS,
  DEPLOYER,
  DAOAddress,
  ReportingAddress,

  name,
  symbol,
  GAUGE_TYPES,
  POOL_PROXY_ADMINS,

  INITIAL_SUPPLY,
  RATE_DENOMINATOR,

  PERCENTAGE,
  TEAM_AMOUNT,
  TEAM_ADDRESSES,


  FUND_ADMINS,
  
})