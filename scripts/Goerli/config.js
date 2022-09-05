const { ethers } = require("hardhat");
const { BigNumber } = require("ethers");

//Accounts
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const DEPLOYER = "0x168F8aA6d0aaeFCF75DdD3fF6793861114C035E8";
const DAOAddress = "0x168F8aA6d0aaeFCF75DdD3fF6793861114C035E8";
const ReportingAddress = "0x168F8aA6d0aaeFCF75DdD3fF6793861114C035E8";

//Configs
const name = "InsureToken";
const symbol = "INSURE";

const INITIAL_SUPPLY = new BigNumber.from("126000000");
const RATE_DENOMINATOR = new BigNumber.from("1000000000000000000"); //1e18

const GAUGE_TYPES = [
  ["Liquidity", BigNumber.from("1000000000000000000")], //10**18
];

const POOL_PROXY_ADMINS = {
  Ownership: DEPLOYER,
  Params: DEPLOYER,
  Emergency: DEPLOYER,
};

const INITIAL_WEIGHT = [
  50, //Single Pool Reward weight
  300, //Index Reward weight
  150, //CDS Reward weight
];

Object.assign(exports, {
  ZERO_ADDRESS,
  DEPLOYER,
  DAOAddress,
  ReportingAddress,

  name,
  symbol,
  GAUGE_TYPES,
  POOL_PROXY_ADMINS,
  INITIAL_WEIGHT,

  INITIAL_SUPPLY,
  RATE_DENOMINATOR,
});
