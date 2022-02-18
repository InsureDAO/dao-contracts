//distribute vested token
const hre = require("hardhat");
const { expect } = require("chai");
const { ethers } = require("hardhat");
const { BigNumber } = require('ethers');
const fs = require("fs");

/***
 *  deploy VestingEscrow and vest
 */

async function main() {
  await hre.run('compile');

  //addresses
  const {
    InsureToken
  } = require("./deployments.js");

  const {
    ZERO_ADDRESS,
    DAOAddress,
    decimals,

    INITIAL_SUPPLY,
    RATE_DENOMINATOR,

    VESTING_START,
    YEAR,
    TEAM_AMOUNT,
    TEAM_ADDRESSES,
    INVESTOR_ADVISOR_AMOUNT,
    INVESTOR_ADVISOR_ADDRESSES,
    INVESTOR_ADVISOR_RATE_ADJUSTER,

    FUND_ADMINS,
  } = require("./config.js");

  const [deployer] = await ethers.getSigners();
  const Insure = await hre.ethers.getContractFactory("InsureToken");
  const insure = await Insure.attach(InsureToken);

  /*** TODO
   * 1. deploy
   * 2. vest for team
   *  a. add_token()
   *  b. fund()
   * 3. vest for investors
   * 4. vest for advisors
   * 5. commit_transfer_ownership => gnosis
   * 
   * 6. gnosis: VestingEscrow.acceptTransferOwnership()
   */

  /**
   * sanity check
   */
  //team
  let teamTotal = BigNumber.from("0");
  for(let i=0; i<TEAM_ADDRESSES; i++){
    teamTotal = teamTotal.add(TEAM_ADDRESSES[i][1])
  }
  expect(teamTotal).to.equal(TEAM_AMOUNT)
  

  //invester and advisor
  let investorTotal = BigNumber.from("0");
  for(let i=0; i<INVESTOR_ADVISOR_ADDRESSES; i++){
    investorTotal = investorTotal.add(INVESTOR_ADVISOR_ADDRESSES[i][1])
  }
  expect(investorTotal).to.equal(INVESTOR_ADVISOR_AMOUNT)

  teamTotal = teamTotal.mul(decimals)
  investorTotal = investorTotal.mul(decimals).div(INVESTOR_ADVISOR_RATE_ADJUSTER)
  let total = teamTotal.add(investorTotal)

  //initial mint
  let init_mint = await insure.balanceOf(deployer.address)
  expect(init_mint.gte(total)).to.equal(true)

  //check%
  /**
   * team = 18.218%
   * investor(3 years) = 0.25%
   * investor(2 years) = 12.483% 
   */
  /**
   * Vesting
   */

  //1. vest for team
  const VestingEscrow = await hre.ethers.getContractFactory("VestingEscrow");
  const vesting_team = await VestingEscrow.deploy(
    InsureToken,
    VESTING_START,
    VESTING_START.add(YEAR.mul(3)),
    true,
    FUND_ADMINS
  );
  //admin = deployer
  console.log("VestingEscrow deployed to:", vesting_team.address)
  let totalAmount  = TEAM_AMOUNT.mul(decimals)

  await insure.approve(vesting_team.address, totalAmount);
  console.log("INSURE approved for team")


  await vesting_team.add_tokens(totalAmount);
  console.log("INSURE token added to team")

  let addresses = []
  let amounts = []
  for(let i=0; i<100; i++){
    if(i<TEAM_ADDRESSES.length){
      addresses.push(TEAM_ADDRESSES[i][0])
      amounts.push(TEAM_ADDRESSES[i][1].mul(decimals))
    }else{
      addresses.push(ZERO_ADDRESS) 
      amounts.push(BigNumber.from("0"))
    }
  }

  await vesting_team.fund(addresses, amounts);
  console.log("team funded")


  //2. vest for investors and advisors
  const vesting_investors = await VestingEscrow.deploy(
    InsureToken,
    VESTING_START,
    VESTING_START.add(YEAR.mul(2)),
    true,
    FUND_ADMINS
  );
  //admin = deployer
  console.log("VestingEscrow deployed to:", vesting_investors.address)

  totalAmount  = INVESTOR_ADVISOR_ADDRESSES.mul(decimals).div(INVESTOR_ADVISOR_RATE_ADJUSTER)

  await insure.approve(vesting_investors.address, totalAmount);
  console.log("INSURE approved for investors")


  await vesting_investors.add_tokens(totalAmount);
  console.log("INSURE token added to investors")

  let addresses = []
  let amounts = []
  for(let i=0; i<100; i++){
    if(i<INVESTOR_ADVISOR_ADDRESSES.length){
      addresses.push(INVESTOR_ADVISOR_ADDRESSES[i][0])
      amounts.push(INVESTOR_ADVISOR_ADDRESSES[i][1].mul(decimals).div(INVESTOR_ADVISOR_RATE_ADJUSTER))
    }else{
      addresses.push(ZERO_ADDRESS) 
      amounts.push(BigNumber.from("0"))
    }
  }

  await vesting_team.fund(addresses, amounts);
  console.log("investor/advisors funded")


}

main()
    .then(() => process.exit(0))
    .catch(error => {
    console.error(error);
    process.exit(1);
    });