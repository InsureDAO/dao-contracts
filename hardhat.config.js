require("@nomiclabs/hardhat-waffle");
require("@nomiclabs/hardhat-web3");
require("solidity-coverage");

/**
 * @type import('hardhat/config').HardhatUserConfig
 */


module.exports = {
  solidity: "0.6.12",
  defaultNetwork: "hardhat",
  networks: {
    hardhat: {
    },
    rinkeby: {
      url: "https://eth-mainnet.alchemyapi.io/v2/123abc123abc123abc123abc123abcde",
      //accounts: [privateKey1, privateKey2, ...]
    }
  },
  solidity: {
    version: "0.6.12",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },
  paths: {
    sources: "./contracts",
    tests: "./test/unitary/Minter",
    cache: "./cache",
    artifacts: "./artifacts"
  },
  mocha: {
    timeout: 20000000
  }
};
