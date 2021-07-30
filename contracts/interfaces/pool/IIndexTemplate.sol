pragma solidity 0.6.12;
//SPDX-License-Identifier: MIT
interface IIndexTemplate {
    function setLeverage(uint256 _target) external;
    function set(address _pool, uint256 _allocPoint) external;
}