pragma solidity >=0.7.5;

/***
*@title Token Converter V1-2
*@author InsureDAO
* SPDX-License-Identifier: MIT
*@notice InsureDAO util contract using UniswapV3
*/

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "../InsureToken.sol";

import "@openzeppelin/contracts/utils/math/Math.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

import "../interfaces/utils/ISwapRouter.sol";
import "../interfaces/utils/IQuoter.sol";


contract ConverterV1_2{
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    ISwapRouter public constant UniswapV3 = ISwapRouter(0xE592427A0AEce92De3Edee1F18E0157C05861564); //rinkeby
    IQuoter public constant Quoter = IQuoter(0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6); //rinkeby

    IERC20 public constant USDC = IERC20(0xeb8f08a975Ab53E34D8a0330E0D34de942C95926); //rinkyby    
    InsureToken public immutable insure_token;

    constructor(address _insure){
        insure_token = InsureToken(_insure);
    }
    

    function swap_exact_to_insure(address _token, uint256 _amountIn, address _to)external returns(bool){
        /***
        *@notice token exchange from USDC to INSURE.
        *@param _token address of token to be used for exchange
        *@param _amountIn amount of USDC for exchange of INSURE
        *@param _to address of INSURE token recipient
        */
        uint256 deadline = block.timestamp + 60; // using 'now' for convenience, for mainnet pass deadline from frontend!
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
        
        ISwapRouter.ExactInputSingleParams memory params = ISwapRouter.ExactInputSingleParams(
            tokenIn,
            tokenOut,
            fee,
            recipient,
            deadline,
            amountIn,
            amountOutMinimum,
            sqrtPriceLimitX96
        );               
        
        UniswapV3.exactInputSingle(params);
        return true;
    }


    function getAmountsIn(uint256 _amountOut)external returns(uint256){
        /***
        *@notice get INSURE amount required to get specific amount of USDC from exchange of INSURE.
        *@param _amountOut amount of USDC
        */
        address tokenIn = address(insure_token);
        address tokenOut = address(USDC);
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

        return amountIn;
    }

    
    function swap_insure_to_exact(uint256 _amountInMax, uint256 _amountOut, address _to)external returns (bool){
        /***
        *@dev only be used in case of emergency_mint(). Swap minted INSURE to USDC to make a payment.
        */
        uint256 deadline = block.timestamp + 60;
        address tokenIn = address(insure_token);
        address tokenOut = address(USDC);
        uint24 fee = 3000;
        address recipient = _to;
        uint256 amountOut = _amountOut;
        uint256 amountInMaximum = _amountInMax;
        uint160 sqrtPriceLimitX96 = 0;
                
        //setup for swap
        require(insure_token.transferFrom(msg.sender, address(this), _amountInMax), 'transferFrom failed.');
        require(insure_token.approve(address(UniswapV3), _amountInMax), 'approve failed.');
        
        ISwapRouter.ExactOutputSingleParams  memory params = ISwapRouter.ExactOutputSingleParams (
            tokenIn,
            tokenOut,
            fee,
            recipient,
            deadline,
            amountOut,
            amountInMaximum,
            sqrtPriceLimitX96
        );
        
        UniswapV3.exactOutputSingle(params);
        return true;
    }

}