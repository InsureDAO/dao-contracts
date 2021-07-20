pragma solidity ^0.6.0;
//SPDX-License-Identifier: MIT
import "./IUniversalMarket.sol";

interface IFactory {
    function commit_transfer_ownership(address)external;

    function apply_transfer_ownership()external;

    function approveReference(IUniversalMarket, uint256, address, bool)external;
    
    function approveTemplate(IUniversalMarket, bool, bool)external;

    function setCondition(IUniversalMarket _template, uint256 _slot, uint256 _target) external;
}