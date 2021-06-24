//Contracts
const InsureToken = artifacts.require("InsureToken");
const VotingEscrow = artifacts.require("VotingEscrow");
const GaugeController = artifacts.require("GaugeController");
const TestLP = artifacts.require("TestLP");
const Minter = artifacts.require("Minter");
const LiquidityGauge = artifacts.require("LiquidityGauge");

//Libraries
const SafeMath = artifacts.require("SafeMath");
const SignedSafeMath = artifacts.require("SignedSafeMath");


const {
    time,
    BN
    } = require('@openzeppelin/test-helpers');


const GAUGE_TYPES = [
    ["Liquidity", new BN("1000000000000000000")], //10**18
]

//-----Variables-----
const POOL_TOKENS = [
    ["Pool1","0xf6c5ba64d11B454Ade45a6429Dddf1924271473E", 12], //Pool1
    ["Pool2", "0x3B7a071F6B347500ef7296e27a440Dd84dB86FDd", 24], //Pool2
    ["Index1","0x801B88695c624fADAeD8D78d6E29E6393B7aC4c5", 100], //Index1
]

const myAddress = "0x9c56673F8446d8B982054dAD1C19D3098dB0716A"; //rinkeby
//-------------------


module.exports = function (deployer) {
  deployer.then(async() => {
    await deployer.deploy(GaugeController, InsureToken.address, VotingEscrow.address);//GaugeController
    await deployer.deploy(Minter, InsureToken.address, GaugeController.address); //Minter
    let token = await InsureToken.deployed();
    await token.set_minter(Minter.address); //set_minter()


    let gauge_controller = await GaugeController.deployed();
    await GAUGE_TYPES.forEach(el => {
        let name = el[0];
        let weight = el[1];
        gauge_controller.add_type(name, weight); //add_type()
    });

    for(let el in POOL_TOKENS){ //LiquidityGauge
        let name = POOL_TOKENS[el][0];
        let lp_token = POOL_TOKENS[el][1];
        let weight = POOL_TOKENS[el][2];

        console.log(name);
        console.log(lp_token);
        console.log(weight);

        console.log(Minter.address);

        await deployer.deploy(LiquidityGauge, lp_token, Minter.address, myAddress);
        let gauge = await LiquidityGauge.deployed();
        console.log(gauge.address);
        await gauge_controller.add_gauge(gauge.address, 1, weight);
    }
  });
};