// SPDX-License-Identifier: MIT

pragma solidity 0.8.7;

interface ICollateralManager{
    function checkStatus(address addr)external returns(bool);
}