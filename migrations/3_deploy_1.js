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

const name = "InsureToken";
const simbol = "Insure";
const decimal = new BN('18');
const INITIAL_SUPPLY = new BN('1303030303000000000000000000');


module.exports = function (deployer) {
  deployer.then(async() => {
    await deployer.link(SafeMath, [InsureToken, VotingEscrow]);
    await deployer.link(SignedSafeMath, [InsureToken, VotingEscrow]);

    await deployer.deploy(InsureToken, name, simbol, decimal); //InsureToken
    await deployer.deploy(
        VotingEscrow,
        InsureToken.address,
        "Vote-escrowed INSURE",
        "veINSURE",
        "veINSURE_1.0.0"
    );//VotingEscrow
  });
};