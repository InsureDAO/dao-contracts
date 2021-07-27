pragma solidity ^0.6.0;
//SPDX-License-Identifier: MIT
interface IPoolTemplate {
    function applyCover(
        uint256 _pending,
        uint256 _payoutNumerator,
        uint256 _payoutDenominator,
        uint256 _incidentTimestamp,
        bytes32[] calldata _targets
    ) external;
}