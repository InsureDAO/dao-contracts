pragma solidity ^0.6.0;
//SPDX-License-Identifier: MIT
interface IAddressProvider {
    function get_registry() external returns(address);
}