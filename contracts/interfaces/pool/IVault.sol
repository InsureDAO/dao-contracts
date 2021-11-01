// SPDX-License-Identifier: MIT

pragma solidity 0.8.7;

interface IVault {
    function setKeeper(address _keeper)external;

    function setController(address _controller)external;

    function commitTransferOwnership(address)external;

    function applyTransferOwnership()external;

    function withdrawAllAttribution(address _to)external returns(uint256);
}