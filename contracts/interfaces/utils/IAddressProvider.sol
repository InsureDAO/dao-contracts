pragma solidity ^0.7.5;
//SPDX-License-Identifier: MIT
interface IAddressProvider {
    function get_registry() external returns(address);
}