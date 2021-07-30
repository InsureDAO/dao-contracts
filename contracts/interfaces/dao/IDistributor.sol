pragma solidity 0.6.12;
//SPDX-License-Identifier: MIT
interface IDistributor {
    function distribute(address _coin) external returns(bool);

}