// SPDX-License-Identifier: MIT

pragma solidity 0.8.7;

interface IFeeModel {
    function getFee(uint256 _premium) external view returns (uint256);

    function setFee(uint256 _target) external;

    function commit_transfer_ownership(address _owner) external;
    function apply_transfer_ownership() external;
}
