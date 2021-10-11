// SPDX-License-Identifier: MIT

pragma solidity 0.8.7;

interface IIndexTemplate {
    function setLeverage(uint256 _target) external;
    function set(address _pool, uint256 _allocPoint) external;
}