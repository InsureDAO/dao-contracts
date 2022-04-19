# DAO contracts

All contract sources are within this directory.

## Subdirectories

- [`FeeDistribution`](FeeDistribution): Contracts used to distribute admin fee. At launch, we simply set wallet instead of this to reduce gas.
- [`testing`](testing): Contracts used exclusively for testing. Not considered to be a core part of this project.

## Contracts

- [`InsureToken`](InsureToken.sol): InsureDAO Token (INSURE), and ERC20 with piecewise-linear mining supply
- [`GaugeController`](GaugeController.sol): Controls liquidity gauges and the issuance of INSURE through the liquidity gauges
- [`LiquidityGauge`](LiquidityGauge.sol): Measures the amount of liquidity provided by each user
- [`Minter`](Minter.sol): Token minting contract used for issuing new INSURE
- [`PoolProxy`](PoolProxy.sol): Insurance pool proxy contract for interactions between the DAO and pool contracts
- [`VotingEscrow`](VotingEscrow.sol): Vesting contract for locking INSURE to participate in DAO governance
- [`VestingEscrow`](Vesting/VestingEscrow.sol): Vests INSURE tokens for multiple addresses over multiple vesting periods
