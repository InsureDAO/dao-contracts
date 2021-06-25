# insuredao-dao-contracts

Solidity contracts used in the InsureDAO Governance.
Folked and Translated from Vyper of Curve Governance DAO, then modified some parameters and codes.

## Overview

InsureDAO consists of multiple smart contracts connected by [Aragon](https://github.com/aragon/aragonOS). Interaction with Aragon occurs through a [modified implementation](https://github.com/curvefi/curve-aragon-voting) of the [Aragon Voting App](https://github.com/aragon/aragon-apps/tree/master/apps/voting). Aragon's standard one token, one vote method is replaced with a weighting system based on locking tokens. InsureDAO has a token (INSURE) which is used for both governance and value accrual.

InsureDAO's governance part is originally from [Curve Finance](https://github.com/curvefi/curve-dao-contracts). Some modification was made to be fit with the [InsureDAO Pool](https://github.com/insureDAO/pool-contracts).

## Testing and Development

### Requirement
- node v10.24.1
### Dependencies
- hardhat v2.3.3
- @nomiclabs/hardhat-ethers v2.0.2
- @nomiclabs/hardhat-waffle v2.0.1
- @nomiclabs/hardhat-web3 v2.0.0
- ethereum-waffle v3.4.0
- ethers v5.3.1
- chai v4.3.4
- solidity-coverage v0.7.16

Those are Developer's current environment.

### Setup
clone the repo and install the developer dependencies:

```
git clone https://github.com/insureDAO/dao-contracts.git
cd dao-contracts
npm install --save-dev
```
This will install latest packages which is not same as above.

### Running the Tests
The test suite is split between [unit](test/unitary) and [integration](test/integration) tests. To run the entire suite:

```
npx hardhat test
```

To run only the unit tests or integration tests, modify ['hardhat.config'](hardhat.config.js)
```
tests: "./test/unitary",
```
or
```
tests: "./test/integration",
```

#### Running a test coverage
[solidity-coverage](https://hardhat.org/plugins/solidity-coverage.html) from Hardhat external plugin is included.
configuration file is ['.solcover'](.solcover.js)
```
npx hardhat coverage
```

## Resources

You may find the following guides useful: 
1. [LP (simple summary of InsureDAO)](https://insuredao.fi/)
2. [InsureDAO pool and governance (now updating the contents)](https://app.gitbook.com/@insuredao/s/insuredao/)
3. [Governance whitepaper](https://docs.google.com/document/d/1KH1pLwgLSWC_EJ7rmktIzDIG0ldOOnRCUhg14C0n4kc/edit?usp=sharing)


## Community

If you have any questions about this project, or wish to engage with us:

- [Twitter](https://twitter.com/insuredao)
- [Discord](https://discord.gg/)


## License

This project is licensed under the [MIT](LICENSE) license.








