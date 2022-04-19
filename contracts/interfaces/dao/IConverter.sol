// SPDX-License-Identifier: MIT

pragma solidity 0.8.10;

interface IConverter {
    function swap_exact_to_insure(
        address _token,
        uint256 _amountIn,
        address _to
    ) external returns (bool);

    function getAmountsIn(address _tokenOut, uint256 _amountOut)
        external
        returns (uint256);

    function swap_insure_to_exact(
        address _tokenOut,
        uint256 _amountOut,
        uint256 _amountInMax,
        address _to
    ) external returns (bool);
}
