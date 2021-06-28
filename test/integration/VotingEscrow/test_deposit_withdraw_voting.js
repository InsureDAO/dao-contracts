const { expect } = require("chai");
const { ethers } = require("hardhat");
const { BigNumber, ContractTransaction } = require('ethers');
const { iteratee } = require("underscore");

describe('LiquidityGauge', function() {
    const YEAR = BigNumber.from(86400*365);
    const WEEK = BigNumber.from(86400*7);

    const name = "InsureToken";
    const simbol = "Insure";
    const decimal = 18;

    const two_to_the_256_minus_1 = (BigNumber.from('2')).pow(BigNumber.from('256')).sub(BigNumber.from('1'));
    const ten_to_the_40 = BigNumber.from("10000000000000000000000000000000000000000");
    

    const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

    let accounts;
    let st_account_n;
    let st_account;
    let st_value = BigNumber.from('0');
    let st_time = BigNumber.from('0');
    let token_balances;
    let voting_balances;
    let unlock_time;
    let st_lock_duration;
    let tx;
    let receipt;

    beforeEach(async () => {
        //import
        [creator, alice, bob, chad, dad, elephant, fei, god, hecta, iloveyou] = await ethers.getSigners();
        accounts = [creator, alice, bob, chad, dad, elephant, fei, god, hecta, iloveyou];
        const Token = await ethers.getContractFactory('TestToken');
        const VotingEscrow = await ethers.getContractFactory('VotingEscrow');

        token = await Token.deploy(name, simbol, decimal);
        voting_escrow = await VotingEscrow.deploy(token.address, "Voting-escrowed Insure", "veInsure", 'veInsure');

        //init
        for(i=0;i<10;i++){
            await token.connect(accounts[i])._mint_for_testing(ten_to_the_40);
            await token.connect(accounts[i]).approve(voting_escrow.address, two_to_the_256_minus_1);
        }

        //setup
        token_balances = [ten_to_the_40, ten_to_the_40, ten_to_the_40, ten_to_the_40, ten_to_the_40, ten_to_the_40, ten_to_the_40, ten_to_the_40, ten_to_the_40, ten_to_the_40];
        voting_balances = [];
        for(i=0;i<10;i++){
            voting_balances.push({value: BigNumber.from("0"), unlock_time: BigNumber.from("0")});
        }
    });

    //--------------------------------------------- functions -----------------------------------------------------------//

    function rdm_value(a){
        let rdm = BigNumber.from(Math.floor(Math.random()*a).toString());
        return rdm;
    }

    //--------------------------------------------- randomly excuted functions -----------------------------------------------------------//
    async function rule_create_lock(){
        console.log("rule_create_lock");

        //st_account
        let rdm = Math.floor(Math.random()*10);//0~9 integer
        st_account_n = rdm;
        st_account = accounts[st_account_n];

        //st_value
        st_value = rdm_value(9007199254740991);

        //number of weeks to lock a deposit
        st_lock_duration = rdm_value(255);//uint8.max

        let timestamp = BigNumber.from((await ethers.provider.getBlock('latest')).timestamp);
        unlock_time = timestamp.add(WEEK.mul(st_lock_duration)).div(WEEK).mul(WEEK);

        if(st_value == 0){
            console.log("--revert: 1, account:",st_account_n );
            await expect(voting_escrow.connect(st_account).create_lock(st_value, unlock_time)).to.revertedWith("dev: need non-zero value");

        }else if(voting_balances[st_account_n]["value"].gt("0")){
            console.log("--revert: 2, account:",st_account_n );
            await expect(voting_escrow.connect(st_account).create_lock(st_value, unlock_time)).to.revertedWith("Withdraw old tokens first");

        }else if(unlock_time.lte(timestamp)){
            console.log("--revert: 3, account:",st_account_n );
            await expect(voting_escrow.connect(st_account).create_lock(st_value, unlock_time)).to.revertedWith("Can only lock until time in the future");

        }else if(unlock_time.gte(timestamp.add(YEAR.mul("4")))){
            console.log("--revert: 4, account:",st_account_n );
            await expect(voting_escrow.connect(st_account).create_lock(st_value, unlock_time)).to.revertedWith("Voting lock can be 4 years max");

        }else{
            console.log("--success, account:",st_account_n );
            tx = await voting_escrow.connect(st_account).create_lock(st_value, unlock_time);
            receipt = await tx.wait();
            voting_balances[st_account_n] = {value: st_value, unlock_time: receipt.events[1]["args"]["locktime"]}
        }
    }

    async function rule_increase_amount(){
        console.log("rule_increase_amount");
        
        //st_account
        let rdm = Math.floor(Math.random()*10);//0~9 integer
        st_account_n = rdm;
        st_account = accounts[st_account_n];

        //st_value
        st_value = rdm_value(9007199254740991);

        let timestamp = BigNumber.from((await ethers.provider.getBlock('latest')).timestamp);

        if(st_value == 0){
            console.log("--revert: 1, account:",st_account_n);
            await expect(voting_escrow.connect(st_account).increase_amount(st_value)).to.revertedWith("dev: need non-zero value");

        }else if(voting_balances[st_account_n]["value"].eq("0")){
            console.log("--revert: 2, account:",st_account_n);
            await expect(voting_escrow.connect(st_account).increase_amount(st_value)).to.revertedWith("No existing lock found");

        }else if(voting_balances[st_account_n]["unlock_time"].lte(timestamp)){
            console.log("--revert: 3, account:",st_account_n);
            await expect(voting_escrow.connect(st_account).increase_amount(st_value)).to.revertedWith("Cannot add to expired lock. Withdraw");

        }else{
            await voting_escrow.connect(st_account).increase_amount(st_value);
            voting_balances[st_account_n]["value"] = voting_balances[st_account_n]["value"].add(st_value);
    
            console.log("--success, account:",st_account_n, "new balance:", voting_balances[st_account_n]["value"]);
        }
    }

    let func = ["rule_create_lock", "rule_increase_amount"];

    describe("test_votingescrow_admin", function(){
        for(let x=0; x<5; x++){
            it("try "+eval("x+1"), async()=>{
                for(let i=0;i<30;i++){
                    let n = await rdm_value(func.length);
                    await eval(func[n])();
                }
            });
        }
    });
});