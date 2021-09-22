pragma solidity 0.8.7;
//SPDX-License-Identifier: MIT
interface ISmartWalletChecker{
    function check(address addr)external returns(bool);
}