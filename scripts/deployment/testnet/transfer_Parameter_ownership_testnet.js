const hre = require("hardhat");
const { ethers } = require("hardhat");
const { BigNumber } = require('ethers');

/***
 * Transfer admin to DAO deployed address.
 * 
 * Before run, make sure private key in the .key file matches with the Pool's owner. 
 */

//===== Config =====//
PARAMETERS = [
    "0x"
]
//=================//

async function main() {
    await hre.run('compile');

    const [eoa] = await ethers.getSigners();
    const PoolProxy = "0x";

    let admin = eoa.address;
    let new_admin = PoolProxy;

    // We get the contract
    const Parameters = await hre.ethers.getContractFactory("Parameters");
    
    for(addr in PARAMETERS){
        parameters = Parameters.attach(addr);

        if(await parameters.get_owner() != admin){
            console.log(admin, "is not the owner of", addr);
            break;
        }

        let deadline = (await parameters.transfer_ownership_deadline()).toNumber();
        let now = (await ethers.provider.getBlock('latest')).timestamp;

        if(deadline == 0){
            await parameters.commit_transfer_ownership(new_admin);
            console.log(`SUCCESS: Ownership transfer of ${addr} has been initialized`);
        }else if(deadline < now){
            await parameters.apply_transfer_ownership();
            console.log(`SUCCESS: Ownership transfer of ${addr} is complete`);
        }else{
            console.log("You need to wait ", deadline - now, "seconds");
        }
    }

}

main()
    .then(() => process.exit(0))
    .catch(error => {
    console.error(error);
    process.exit(1);
    });