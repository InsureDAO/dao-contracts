pragma solidity ^0.7.5;
//SPDX-License-Identifier: MIT
interface IInsureToken {
    function mint(address _to, uint256 _value)external returns(bool);
    function emergency_mint(uint256 _amountOut, address _to)external;
    function approve(address _spender, uint256 _value)external;
}