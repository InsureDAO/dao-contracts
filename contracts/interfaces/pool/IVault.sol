pragma solidity 0.8.7;
//SPDX-License-Identifier: MIT
interface IVault {
    function setKeeper(address _keeper)external;

    function setController(address _controller)external;

    function commitTransferOwnership(address)external;

    function applyTransferOwnership()external;

    function withdrawAllAttribution(address _to)external returns(uint256);
}