//Libraries
const SafeMath = artifacts.require("SafeMath");
const SignedSafeMath = artifacts.require("SignedSafeMath");


module.exports = function (deployer) {
  deployer.then(async() => {
    await deployer.deploy(SafeMath);
    await deployer.deploy(SignedSafeMath);
  });
};