// SPDX-License-Identifier: MIT

pragma solidity 0.8.7;

interface IVault {
    function commit_transfer_ownership(address)external;

    function apply_transfer_ownership()external;

    function setController(address)external;

    function withdrawAllAttribution(address _to)external returns(uint256);
}
