pragma solidity >=0.7.5;

/***
 *@title Token Converter V1-2
 *@author InsureDAO
 * SPDX-License-Identifier: MIT
 *@notice InsureDAO util contract using UniswapV3
 *@dev test for this code is done on mainnet fork
 */

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "../InsureToken.sol";
import "../interfaces/dao/IConverter.sol";

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

import "@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol";
import "@uniswap/v3-periphery/contracts/interfaces/IQuoter.sol";

contract ConverterV1_2 is IConverter {
    using SafeERC20 for IERC20;

    event getAmountIn(
        address tokenOut,
        uint256 amountOut,
        address tokenIn,
        uint256 amountIn
    );

    ISwapRouter public constant UniswapV3 =
        ISwapRouter(0xE592427A0AEce92De3Edee1F18E0157C05861564); //mainnet
    IQuoter public constant Quoter =
        IQuoter(0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6); //mainnet

    InsureToken public immutable insure_token;

    constructor(address _insure) {
        insure_token = InsureToken(_insure);
    }

    function swap_exact_to_insure(
        address _token,
        uint256 _amountIn,
        address _to
    ) external override returns (bool) {
        /***
         *@notice token exchange from USDC to INSURE.
         *@param _token address of token to be used for exchange
         *@param _amountIn amount of USDC for exchange of INSURE
         *@param _to address of INSURE token recipient
         */
        uint256 deadline;
        unchecked {
            deadline = block.timestamp + 60; // using 'now' for convenience, for mainnet pass deadline from frontend!
        }
        address tokenIn = address(_token);
        address tokenOut = address(insure_token);
        uint24 fee = 3000;
        address recipient = _to;
        uint256 amountIn = _amountIn;
        uint256 amountOutMinimum = 1;
        uint160 sqrtPriceLimitX96 = 0;

        //setup for swap
        IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), _amountIn);
        IERC20(tokenIn).safeApprove(address(UniswapV3), _amountIn);

        ISwapRouter.ExactInputSingleParams memory params = ISwapRouter
            .ExactInputSingleParams(
                tokenIn,
                tokenOut,
                fee,
                recipient,
                deadline,
                amountIn,
                amountOutMinimum,
                sqrtPriceLimitX96
            );

        require(UniswapV3.exactInputSingle(params) > 0, "return 0 token");
        return true;
    }

    function getAmountsIn(address _tokenOut, uint256 _amountOut)
        external
        override
        returns (uint256)
    {
        /***
         *@notice get INSURE amount required to get specific amount of _tokenOut from exchange of INSURE.
         *@param _amountOut amount of _tokenOut
         */
        address tokenIn = address(insure_token);
        address tokenOut = address(_tokenOut);
        uint24 fee = 3000;
        uint256 amountOut = _amountOut;
        uint160 sqrtPriceLimitX96 = 0;

        uint256 amountIn = Quoter.quoteExactOutputSingle(
            tokenIn,
            tokenOut,
            fee,
            amountOut,
            sqrtPriceLimitX96
        );

        emit getAmountIn(
            _tokenOut,
            _amountOut,
            address(insure_token),
            amountIn
        );
        return amountIn;
    }

    function swap_insure_to_exact(
        address _tokenOut,
        uint256 _amountOut,
        uint256 _amountInMax,
        address _to
    ) external override returns (bool) {
        /***
         *@dev only be used in case of emergency_mint(). Swap minted INSURE to USDC to make a payment.
         */
        uint256 deadline;
        unchecked {
            deadline = block.timestamp + 60;
        }
        address tokenIn = address(insure_token);
        address tokenOut = address(_tokenOut);
        uint24 fee = 3000;
        address recipient = _to;
        uint256 amountOut = _amountOut;
        uint256 amountInMaximum = _amountInMax;
        uint160 sqrtPriceLimitX96 = 0;

        //setup for swap
        IERC20(insure_token).safeTransferFrom(
            msg.sender,
            address(this),
            _amountInMax
        );
        IERC20(insure_token).safeApprove(address(UniswapV3), _amountInMax);

        ISwapRouter.ExactOutputSingleParams memory params = ISwapRouter
            .ExactOutputSingleParams(
                tokenIn,
                tokenOut,
                fee,
                recipient,
                deadline,
                amountOut,
                amountInMaximum,
                sqrtPriceLimitX96
            );

        //swap
        UniswapV3.exactOutputSingle(params);

        return true;
    }
}
