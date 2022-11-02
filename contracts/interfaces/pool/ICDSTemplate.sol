// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;

interface ICDSTemplate {
    function compensate(uint256) external returns (uint256 _compensated);

    //onlyOwner
    function defund(address _to, uint256 _amount) external;

    function deposit(uint256 _amount) external returns (uint256 _mintAmount);

    function withdraw(uint256 _amount) external;
}
