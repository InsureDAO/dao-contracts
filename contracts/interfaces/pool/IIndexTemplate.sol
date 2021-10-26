pragma solidity 0.8.7;
//SPDX-License-Identifier: MIT
interface IIndexTemplate {
    function setPaused(bool) external; //Universal
    function changeMetadata(string calldata) external; //Universal
    function setLeverage(uint256) external;
    function set(uint256, address, uint256) external;
}