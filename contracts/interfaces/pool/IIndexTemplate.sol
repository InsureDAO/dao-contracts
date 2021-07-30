pragma solidity ^0.7.5;
//SPDX-License-Identifier: MIT
interface IIndexTemplate {
    function setLeverage(uint256 _target) external;
    function set(address _pool, uint256 _allocPoint) external;
}