//distribute vested token
const hre = require("hardhat");
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

    INITIAL_SUPPLY,
    RATE_DENOMINATOR,

    PERCENTAGE,
    TEAM_AMOUNT,
    TEAM_ADDRESSES,

    FUND_ADMINS,
  } = require("./config.js");

  const [deployer] = await ethers.getSigners();

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


  
  //1. deploy
  const VestingEscrow = await hre.ethers.getContractFactory("VestingEscrow");
  const vesting_team = await VestingEscrow.deploy(
    InsureToken,
    1644327000, //2022/02/08 22:30:00
    1739021400, //2025/02/08 22:30:00
    true,
    FUND_ADMINS
  );
  //admin = deployer
  console.log("VestingEscrow deployed to:", vesting_team.address)


  //2. vest for team
  const Insure = await hre.ethers.getContractFactory("InsureToken");
  const insure = await Insure.attach(InsureToken);

  const team_amount = TEAM_AMOUNT.mul(RATE_DENOMINATOR)

  await insure.approve(vesting_team.address, team_amount);
  console.log("INSURE approved for team")

  await vesting_team.add_tokens(team_amount);
  console.log("INSURE token added to team")

  let addresses = []
  let amounts = []
  for(let i=0; i<100; i++){
    if(i<TEAM_ADDRESSES.length){
      let amount = team_amount.mul(TEAM_ADDRESSES[i][1]).div(PERCENTAGE)

      addresses.push(TEAM_ADDRESSES[i][0]) 
      amounts.push(amount)
    }else{
      addresses.push(ZERO_ADDRESS) 
      amounts.push(BigNumber.from("0"))
    }
  }

  await vesting_team.fund(addresses, amounts);
  console.log("team funded")

}

main()
    .then(() => process.exit(0))
    .catch(error => {
    console.error(error);
    process.exit(1);
    });