// SPDX-License-Identifier: MIT

pragma solidity 0.8.7;

interface IPremiumModel {
    function getPremium(
        uint256 _amount,
        uint256 _term,
        uint256 _totalLiquidity,
        uint256 _lockedAmount
    ) external view returns (uint256);

    function commit_transfer_ownership(address _owner) external;
    function apply_transfer_ownership() external;
    function setPremium(uint256 _baseRatePerYear, uint256 _multiplierPerYear)external;
    function setOptions(
        uint256 _a,
        uint256 _b,
        uint256 _c,
        uint256 _d
    ) external;
}
