// SPDX-License-Identifier: MIT

pragma solidity 0.8.10;

interface IEmergencyMintModule {
    function mint(address _amount) external;

    function repayDebt() external;
}
