# insuredao-dao-contracts

Solidity contracts used in the InsureDAO Governance.
Folked and Translated from Vyper of Curve Governance DAO, then modified some parameters and codes.

## Overview

InsureDAO consists of multiple smart contracts connected by [Aragon](https://github.com/aragon/aragonOS). Interaction with Aragon occurs through a [modified implementation](https://github.com/curvefi/curve-aragon-voting) of the [Aragon Voting App](https://github.com/aragon/aragon-apps/tree/master/apps/voting). Aragon's standard one token, one vote method is replaced with a weighting system based on locking tokens. InsureDAO has a token (INSURE) which is used for both governance and value accrual.

## Testing and Development

### Dependencies
- Solidity v0.6.12
- hardhat v2.3.0

### Setup
clone the repo and install the developer dependencies:

```
git clone https://github.com/insuredao/insuredao-dao-contracts.git
cd insuredao-dao-contracts
npm install --save-dev
```

### Running the Tests
The test suite is split between [unit](test/unitary) and [integration](test/integration) tests. To run the entire suite:

```
npx hardhat test
```

To run only the unit tests or integration tests, modify ['hardhat.config'](hardhat.config.js)
```
tests: "./test/unitary",
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


## Community

If you have any questions about this project, or wish to engage with us:

- [Twitter](https://twitter.com/insuredao)
- [Discord](https://discord.gg/)


## License

This project is licensed under the [MIT](LICENSE) license.








