pragma solidity ^0.7.5;
//SPDX-License-Identifier: MIT
interface IDistributor {
    function distribute(address _coin) external returns(bool);

}