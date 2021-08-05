pragma solidity >=0.7.5;
pragma abicoder v2;

import "../libraries/token/ERC20/IERC20.sol";
import "../InsureToken.sol";

import "../libraries/math/Math.sol";
import "../libraries/math/SafeMath.sol";
import "../libraries/utils/ReentrancyGuard.sol";

import "../interfaces/utils/ISwapRouter.sol";
import "../interfaces/utils/IQuoter.sol";

//InsureDAO util contract using Uniswap V3
contract ConverterV1{
    using SafeMath for uint256;

    IUniswapRouter public constant UniswapV3 = IUniswapRouter(0xE592427A0AEce92De3Edee1F18E0157C05861564); //rinkeby
    IQuoter public constant Quoter = IQuoter(0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6); //rinkeby

    IERC20 public constant USDC = IERC20(0xeb8f08a975Ab53E34D8a0330E0D34de942C95926); //rinkyby    
    InsureToken public immutable insure_token;

    constructor(address _insure)public{
        insure_token = InsureToken(_insure);
    }
    
    /***
    *@dev For FeeDistributorV1. Buy back insure and burn
    */
    function swap_exact_to_insure(uint256 _amountIn, address _to)external returns(bool){
        uint256 deadline = block.timestamp + 60; // using 'now' for convenience, for mainnet pass deadline from frontend!
        address tokenIn = address(USDC);
        address tokenOut = address(insure_token);
        uint24 fee = 3000;
        address recipient = _to;
        uint256 amountIn = _amountIn;
        uint256 amountOutMinimum = 1;
        uint160 sqrtPriceLimitX96 = 0;
                
        //setup for swap
        require(USDC.transferFrom(msg.sender, address(this), _amountIn), 'transferFrom failed.');
        require(USDC.approve(address(UniswapV3), _amountIn), 'approve failed.');
        
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


    /***
    *@dev only be used in case of emergency_mint(). To know how many INSURE is required.
    */
    function getAmountsIn(uint256 _amountOut)external returns(uint256){
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

    /***
    *@dev only be used in case of emergency_mint(). Swap minted INSURE to USDC to make a payment.
    */
    function swap_insure_to_exact(uint256 _amountInMax, uint256 _amountOut, address _to)external returns (bool){
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