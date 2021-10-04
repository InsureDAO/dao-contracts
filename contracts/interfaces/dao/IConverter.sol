pragma solidity 0.8.7;

interface IConverter {
    function swap_exact_to_insure(uint256 _amountIn, address _to)external returns(bool);
    function getAmountsIn(uint256 _amountOut)external view returns(uint256);
    function swap_insure_to_exact(uint256 _amountIn, uint256 _amountOut, address _to)external;
}