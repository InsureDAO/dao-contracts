// SPDX-License-Identifier: MIT

pragma solidity 0.8.7;

interface IUniversalMarket {

    function setPaused(bool _state) external;
    function changeMetadata(string calldata _metadata) external;
}
