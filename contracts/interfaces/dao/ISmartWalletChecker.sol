pragma solidity ^0.7.5;
//SPDX-License-Identifier: MIT
interface ISmartWalletChecker{
    function check(address addr)external returns(bool);
}