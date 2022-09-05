const hre = require("hardhat");
const { ethers } = require("hardhat");
const { BigNumber } = require("ethers");
const fs = require("fs");

async function main() {
  await hre.run("compile");

  //----- IMPORT -----//
  const [deployer] = await ethers.getSigners();
  const { GAUGE_TYPES } = require("./config.js");
  const LiquidityGauge = await hre.ethers.getContractFactory("LiquidityGauge");

  let weight = GAUGE_TYPES[el][1];
  let gauge_controller = "0xbF77F0e2C4A860d5f98d06BbbBA85242D50D3311";
  let minter = "0x71Be077d20a6dc38C235BbCCEa900C36eE841F0E";
  let ownership = "0xD62Eb8de81bCa609ed82cC9090c595bD00Dbffa2";
  let lp_token = "0xbC6463bD7F53Db06a2247D181Dc784bE8c3E302f"; //InsureDepositor's vlINSURE

  let liquidity_gauge = await LiquidityGauge.deploy(lp_token, minter, ownership);
  await liquidity_gauge.deployed();

  console.log("liquidity_gauge.address:", liquidity_gauge.address);
  let tx = await gauge_controller.add_gauge(liquidity_gauge.address, 1, weight);
  await tx.wait();

  console.log("LiquidityGauge deployed to:", liquidity_gauge.address, "{", lp_token, weight, "}");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
