pragma solidity ^0.6.0;
//SPDX-License-Identifier: MIT
interface ISmartWalletChecker{
    function check(address addr)external returns(bool);
}