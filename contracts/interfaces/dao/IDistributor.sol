pragma solidity 0.8.7;
//SPDX-License-Identifier: MIT
interface IDistributor {
    function distribute(address _coin) external returns(bool);

}