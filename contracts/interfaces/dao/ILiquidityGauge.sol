pragma solidity 0.6.12;
//SPDX-License-Identifier: MIT
interface ILiquidityGauge {
    function user_checkpoint(address addr)external returns (bool);
    function integrate_fraction(address addr)external view returns (uint256);
}