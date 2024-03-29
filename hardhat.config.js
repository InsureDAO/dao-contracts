require("@nomiclabs/hardhat-waffle");
require("@nomiclabs/hardhat-web3");
require("solidity-coverage");
require("@nomiclabs/hardhat-etherscan");
require("dotenv").config();

const { ETHERSCAN_API, KEY, INFURA_KEY, GOERLI_URL } = process.env;

module.exports = {
  solidity: "0.8.10",
  defaultNetwork: "hardhat",
  networks: {
    hardhat: {
      initialBaseFeePerGas: 0,
      //forking: {url: "https://eth-mainnet.alchemyapi.io/v2/-vmufhhPyGeTxZH6ep9q2PuHjaPp4l0u",} //remove comment when testing mainnet fork
    },
    rinkeby: {
      url: `https://rinkeby.infura.io/v3/${INFURA_KEY}`,
      accounts: [`0x${KEY}`],
      gas: 6e6,
      gasPrice: 3e10,
      timeout: 2000000000,
    },
    ropsten: {
      url: `https://ropsten.infura.io/v3/${INFURA_KEY}`,
      accounts: [`0x${KEY}`],
    },
    goerli: {
      url: GOERLI_URL,
      accounts: [`0x${KEY}`],
    },
  },
  solidity: {
    version: "0.8.10",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  paths: {
    sources: "./contracts",
    tests: "./test/local",
    //tests: "./test/mainnet_fork",
    //tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
  mocha: {
    timeout: 20000000,
  },
  gasReporter: {
    currency: "ETH",
    gasPrice: 100,
  },
  etherscan: {
    // Your API key for Etherscan
    // Obtain one at https://etherscan.io/
    apiKey: `${ETHERSCAN_API}`,
  },
};
