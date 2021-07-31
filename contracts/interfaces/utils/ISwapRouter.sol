pragma solidity >=0.6.0;
//SPDX-License-Identifier: MIT

import './IUniswapV3SwapCallback.sol';
import './IUniswapV3Pool.sol';

interface ISwapRouter is IUniswapV3SwapCallback {

    function uniswapV3SwapCallback(
        int256 amount0Delta,
        int256 amount1Delta,
        bytes calldata _data
    ) external override;
       
}
