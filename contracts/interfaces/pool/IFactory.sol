// SPDX-License-Identifier: MIT

pragma solidity 0.8.7;

import "./IUniversalMarket.sol";

interface IFactory {
    function approveTemplate(IUniversalMarket, bool, bool, bool)external;

    function approveReference(IUniversalMarket, uint256, address, bool)external;

    function setCondition(IUniversalMarket, uint256, uint256) external;

    function createMarket(
        IUniversalMarket template,
        string memory _metaData,
        uint256[] memory _conditions,
        address[] memory _references
    ) external returns (address);

    function commitTransferOwnership(address)external;

    function applyTransferOwnership()external;
}