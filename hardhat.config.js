require("@nomiclabs/hardhat-waffle");
require("@nomiclabs/hardhat-web3");
require("solidity-coverage");

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
const fs = require("fs");
const key = fs.readFileSync(".key").toString().trim();
const infuraKey = fs.readFileSync(".infuraKey").toString().trim();

module.exports = {
  solidity: "0.8.7",
  defaultNetwork: "hardhat",
  networks: {
    hardhat: {
      initialBaseFeePerGas: 0,
      forking: {
        url: "https://eth-mainnet.alchemyapi.io/v2/-vmufhhPyGeTxZH6ep9q2PuHjaPp4l0u",
      }
    },
    rinkeby: {
      url: `https://rinkeby.infura.io/v3/${infuraKey}`,
      accounts: [`0x${key}`] //Dev: Change the address when do the public testnet event
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
    tests: "./test/mainnet_fork",
    cache: "./cache",
    artifacts: "./artifacts"
  },
  mocha: {
    timeout: 20000000
  },
};