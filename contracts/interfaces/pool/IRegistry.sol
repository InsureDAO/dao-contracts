pragma solidity ^0.7.5;
//SPDX-License-Identifier: MIT
interface IRegistry {
    function commit_transfer_ownership(address)external;

    function apply_transfer_ownership()external;

    function supportMarket(address _market) external;

    function setCDS(address _address, address _target) external; 

    function isListed(address _market) external view returns (bool);

    function setFactory(address _factory) external;
}
