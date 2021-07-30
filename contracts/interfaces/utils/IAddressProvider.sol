pragma solidity 0.6.12;
//SPDX-License-Identifier: MIT
interface IAddressProvider {
    function get_registry() external returns(address);
}