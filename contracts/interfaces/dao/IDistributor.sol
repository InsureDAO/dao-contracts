// SPDX-License-Identifier: MIT

pragma solidity 0.8.7;

interface IDistributor {
    function distribute(address _coin) external returns(bool);

}