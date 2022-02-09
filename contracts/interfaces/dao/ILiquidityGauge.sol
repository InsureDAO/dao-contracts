// SPDX-License-Identifier: MIT

pragma solidity 0.8.10;

interface ILiquidityGauge {
    function user_checkpoint(address _addr) external returns (bool);

    function integrate_fraction(address _addr) external view returns (uint256);
}
