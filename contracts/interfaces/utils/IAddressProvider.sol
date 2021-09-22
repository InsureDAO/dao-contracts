pragma solidity 0.8.7;
//SPDX-License-Identifier: MIT
interface IAddressProvider {
    function get_registry() external returns(address);
}