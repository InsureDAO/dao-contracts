pragma solidity 0.8.7;
//SPDX-License-Identifier: MIT
interface ILiquidityGauge {
    function user_checkpoint(address addr)external returns (bool);
    function integrate_fraction(address addr)external view returns (uint256);
}