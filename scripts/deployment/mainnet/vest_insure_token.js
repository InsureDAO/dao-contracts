const hre = require("hardhat");
const { ethers } = require("hardhat");
const { BigNumber } = require('ethers');

async function main() {
    await hre.run('compile');

    const [deployer] = await ethers.getSigners();


    // We get the contract to deploy
    const InsureToken = await hre.ethers.getContractFactory("InsureToken");
    const VestingEscrow = await hre.ethers.getContractFactory("VestingEscrow");

    const it_address = "0x";

    const fund_admins = [
        "0x",
        "0x",
        "0x",
        "0x"
    ]

    const TOTAL_AMOUNT = 0;
    const VESTING_PERIOD = 86400 * 365 * 2;

    const VESTING = [
        ["0x", 0], //investors
        ["0x", 0], 
        ["0x", 0],
        ["0x", 0],
        ["0x", 0],
    ]

    const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";



    //start
    console.log("deployer:", deployer.address);

    //deploy
    const insure_token = await InsureToken.attach();

    const start_time = await insure_token.future_epoch_time_write.call();

    const vesting_escrow = await VestingEscrow.deploy(
        it_address,
        start_time,
        start_time + VESTING_PERIOD,
        false,
        fund_admins
    )

    let vesting_addresses = [];
    for(i=0; i<100; i++){
        if(i<VESTING.length){
            vesting_addresses.push(VESTING[i][0]);
        }else{
            vesting_addresses.push(ZERO_ADDRESS);
        }
    }

    let vesting_amounts = [];
    for(i=0; i<100; i++){
        if(i<VESTING.length){
            vesting_amounts.push(VESTING[i][1]);
        }else{
            vesting_amounts.push(0);
        }
    }

    let tx = await InsureToken.approve(vesting_escrow.address, TOTAL_AMOUNT);
    await tx.wait();

    tx = await VestingEscrow.add_token(TOTAL_AMOUNT);
    await tx.wait();

    await VestingEscrow.fund(vesting_addresses, vesting_amounts);

    await VestingEscrow.commit_transfer_ownership(ZERO_ADDRESS);
    await VestingEscrow.apply_transfer_ownership();


}

main()
    .then(() => process.exit(0))
    .catch(error => {
    console.error(error);
    process.exit(1);
    });