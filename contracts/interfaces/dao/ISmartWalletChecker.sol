// SPDX-License-Identifier: MIT

pragma solidity 0.8.7;

interface ISmartWalletChecker{
    function check(address addr)external returns(bool);
}