// SPDX-License-Identifier: MIT

pragma solidity 0.8.10;

interface IAddressProvider {
    function get_registry() external returns(address);
}