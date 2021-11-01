// SPDX-License-Identifier: MIT

pragma solidity 0.8.7;

interface IIndexTemplate {
    function setPaused(bool) external; //Universal
    function changeMetadata(string calldata) external; //Universal
    function setLeverage(uint256) external;
    function set(uint256, address, uint256) external;
}