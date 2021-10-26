pragma solidity 0.8.7;
//SPDX-License-Identifier: MIT
interface IRegistry {
    function setFactory(address _factory) external;

    function supportMarket(address) external;

    function setExistence(address, uint256) external;

    function setCDS(address, address) external;

    function isListed(address) external view returns (bool);

    function commitTransferOwnership(address)external;

    function applyTransferOwnership()external;
}
