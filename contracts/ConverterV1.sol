pragma solidity 0.6.12;

import "./libraries/token/ERC20/IERC20.sol";
import "./InsureToken.sol";

import "./libraries/math/Math.sol";
import "./libraries/math/SafeMath.sol";
import "./libraries/utils/ReentrancyGuard.sol";
import "./interfaces/IUniswapV2Router02.sol";

//InsureDAO util contract using Uniswap V2
contract ConverterV1{
    using SafeMath for uint256;

    IUniswapV2Router02 public UniswapV2 = IUniswapV2Router02(0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D); //rinkeby
    InsureToken public insure_token;
    IERC20 public WETH = IERC20(0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2); //rinkeby
    IERC20 public DAI = IERC20(0x6B175474E89094C44Da98b954EedeAC495271d0F); //rinkyby

    constructor(address _insure)public{
        insure_token = InsureToken(_insure);
    }
    
    /***
    *@dev For FeeDistributorV1. Buy back insure and burn
    */
    function swap_exact_to_insure(uint256 _amountIn, address _to)external returns(bool){
        //setup for swap
        require(DAI.transferFrom(msg.sender, address(this), _amountIn), 'transferFrom failed.');
        require(DAI.approve(address(UniswapV2), _amountIn), 'approve failed.');

        address[] memory path = new address[](3);
        path[0] = address(DAI);
        path[1] = address(WETH);
        path[2] = address(insure_token); //insure token

        //swap
        UniswapV2.swapExactTokensForTokens(_amountIn, 0, path, _to, block.timestamp.add(25));

        return true;
    }


    /***
    *@dev only be used in case of emergency_mint(). To know how many INSURE is required.
    */
    function getAmountsIn(uint256 _amountOut)external view returns(uint256){
        address[] memory path = new address[](3);
        path[0] = address(insure_token);
        path[1] = address(WETH);
        path[2] = address(DAI);

        uint256[] memory amountsIn = UniswapV2.getAmountsIn(_amountOut, path);
        return amountsIn[0]; //required Insure Token
    }

    /***
    *@dev only be used in case of emergency_mint(). Swap minted INSURE to DAI to make a payment.
    */
    function swap_insure_to_exact(uint256 _amountInMax, uint256 _amountOut, address _to)external{
        //setup for swap
        require(insure_token.transferFrom(msg.sender, address(this), _amountInMax), 'transferFrom failed.');
        require(insure_token.approve(address(UniswapV2), _amountInMax), 'approve failed.');

        address[] memory path = new address[](3);
        path[0] = address(insure_token); //insure token
        path[1] = address(WETH);
        path[2] = address(DAI);
        
        UniswapV2.swapTokensForExactTokens(_amountOut, _amountInMax, path, _to, block.timestamp.add(25));
    }

}