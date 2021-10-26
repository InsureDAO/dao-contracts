pragma solidity 0.8.7;
//SPDX-License-Identifier: MIT
interface IUniversalMarket {

    function setPaused(bool _state) external;
    function changeMetadata(string calldata _metadata) external;
}
