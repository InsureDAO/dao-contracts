// SPDX-License-Identifier: MIT

pragma solidity 0.8.7;

interface IAddressProvider {
    function get_registry() external returns(address);
}