pragma solidity ^0.6.0;
//SPDX-License-Identifier: MIT
interface IDistributor {
    function distribute(address _coin) external returns(bool);

}