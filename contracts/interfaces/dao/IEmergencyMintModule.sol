// SPDX-License-Identifier: MIT

pragma solidity 0.8.7;

interface IEmergencyMintModule {
    function mint(address amount) external;
    function repayDebt()external;
}