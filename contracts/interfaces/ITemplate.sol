pragma solidity ^0.6.0;
//SPDX-License-Identifier: MIT
interface ITemplate {

    function withdrawFees(address) external returns(uint256);

    function setPaused(bool) external;

    function transferFrom(address, address, uint256)external returns(bool);

    function transfer(address, uint256)external returns(bool);

    function changeMetadata(string calldata)external;

    function applyCover(
        uint256,
        uint256,
        uint256,
        uint256,
        bytes32[] calldata
    ) external;
}