pragma solidity 0.6.12;
//SPDX-License-Identifier: MIT
interface ISmartWalletChecker{
    function check(address addr)external returns(bool);
}