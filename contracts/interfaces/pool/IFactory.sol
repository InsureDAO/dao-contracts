pragma solidity 0.6.12;
//SPDX-License-Identifier: MIT
import "./IUniversalMarket.sol";

interface IFactory {
    function commit_transfer_ownership(address)external;

    function apply_transfer_ownership()external;

    function approveReference(IUniversalMarket, uint256, address, bool)external;
    
    function approveTemplate(IUniversalMarket, bool, bool)external;

    function setCondition(IUniversalMarket _template, uint256 _slot, uint256 _target) external;

    function createMarket(
        IUniversalMarket template,
        string memory _metaData,
        string memory _name,
        string memory _symbol,
        uint8 _decimals,
        uint256[] memory _conditions,
        address[] memory _references
    ) external returns (address);
}