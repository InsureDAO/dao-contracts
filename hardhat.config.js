require("@nomiclabs/hardhat-waffle");
require("@nomiclabs/hardhat-web3");
require("solidity-coverage");
//require("hardhat-gas-reporter");

/**
 * @type import('hardhat/config').HardhatUserConfig
 */

//create your own .key & .infuraKey files
const fs = require("fs");
const key = fs.readFileSync(".key").toString().trim();
const infuraKey = fs.readFileSync(".infuraKey").toString().trim();

module.exports = {
  solidity: "0.8.7",
  defaultNetwork: "hardhat",
  networks: {
    hardhat: {
      initialBaseFeePerGas: 0,
      //forking: {url: "https://eth-mainnet.alchemyapi.io/v2/-vmufhhPyGeTxZH6ep9q2PuHjaPp4l0u",} //remove comment when testing mainnet fork
    },
    rinkeby: {
      url: `https://rinkeby.infura.io/v3/${infuraKey}`,
      accounts: [`0x${key}`]
    }
  },
  solidity: {
    version: "0.8.7",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },
  paths: {
    sources: "./contracts",
    tests: "./test/local",
    //tests: "./test/mainnet_fork",
    //tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts"
  },
  mocha: {
    timeout: 20000000
  },
  gasReporter: {
    currency: 'ETH',
    gasPrice: 100
  }
};