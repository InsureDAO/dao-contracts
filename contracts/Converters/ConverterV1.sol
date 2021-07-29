pragma solidity 0.6.12;

import "../libraries/token/ERC20/IERC20.sol";
import "../InsureToken.sol";

import "../libraries/math/Math.sol";
import "../libraries/math/SafeMath.sol";
import "../libraries/utils/ReentrancyGuard.sol";
import "../interfaces/ISwapRouter.sol";

//InsureDAO util contract using Uniswap V2
contract ConverterV1{
    using SafeMath for uint256;

    ISwapRouter public UniswapV3 = ISwapRouter(0x273Edaa13C845F605b5886Dd66C89AB497A6B17b); //rinkeby
    IQuoter public Quoter = IQuoter(0x91a64CCaead471caFF912314E466D9CF7C55E0E8); //rinkeby
    InsureToken public insure_token;
    IERC20 public WETH = IERC20(0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2); //rinkeby
    IERC20 public USDC = IERC20(0xeb8f08a975Ab53E34D8a0330E0D34de942C95926); //rinkyby

    /// @dev The length of the bytes encoded address
    uint256 private constant ADDR_SIZE = 20;
    /// @dev The length of the bytes encoded fee
    uint256 private constant FEE_SIZE = 3;

    /// @dev The offset of a single token address and pool fee
    uint256 private constant NEXT_OFFSET = ADDR_SIZE + FEE_SIZE;

    struct SwapCallbackData {
        bytes path;
        address payer;
    }

    constructor(address _insure)public{
        insure_token = InsureToken(_insure);
    }
    
    /***
    *@dev For FeeDistributorV1. Buy back insure and burn
    */
    function swap_exact_to_insure(uint256 _amountIn, address _to)external returns(bool){
        //setup for swap
        require(USDC.transferFrom(msg.sender, address(this), _amountIn), 'transferFrom failed.');
        require(USDC.approve(address(UniswapV3), _amountIn), 'approve failed.');

        bytes tokenA = address(USDC);
        bytes tokenB = address(insure_token);
        uint24 fee = _amountIn * 3 / 1000;

        bytes data = SwapCallbackData({path: abi.encodePacked(tokenA, fee, tokenB), payer: _to});

        UniswapV3.uniswapV3SwapCallback(_amountIn, 0, data);


        // address[] memory path = new address[](3);
        // path[0] = address(USDC);
        // path[1] = address(WETH);
        // path[2] = address(insure_token); //insure token

        //swap
        // UniswapV2.swapExactTokensForTokens(_amountIn, 0, path, _to, block.timestamp.add(25));

        return true;
    }


    /***
    *@dev only be used in case of emergency_mint(). To know how many INSURE is required.
    */
    function getAmountsIn(uint256 _amountOut)external view returns(uint256){
        
        bytes tokenA = address(insure_token);
        bytes tokenB = address(USDC);
        uint24 fee = _amountOut * 3 / 1000;

        uint256 amountIn = Quoter.quoteExactOutput(abi.encodePacked(tokenA, fee, tokenB), _amountOut);

        return amountIn;

        // uint256[] memory amountsIn = UniswapV2.getAmountsIn(_amountOut, path);
    }

    /***
    *@dev only be used in case of emergency_mint(). Swap minted INSURE to USDC to make a payment.
    */
    function swap_insure_to_exact(uint256 _amountInMax, uint256 _amountOut, address _to)external returns (bool){
        //setup for swap
        require(insure_token.transferFrom(msg.sender, address(this), _amountInMax), 'transferFrom failed.');
        require(insure_token.approve(address(UniswapV3), _amountInMax), 'approve failed.');

        bytes tokenA = address(insure_token);
        bytes tokenB = address(USDC);
        uint24 fee = _amountOut * 3 / 1000;

        bytes data = SwapCallbackData({path: abi.encodePacked(tokenA, fee, tokenB), payer: _to});

        UniswapV3.uniswapV3SwapCallback(_amountOut, _amountInMax, data);

        // address[] memory path = new address[](3);
        // path[0] = address(insure_token); //insure token
        // path[1] = address(WETH);
        // path[2] = address(USDC);
        
        // UniswapV2.swapTokensForExactTokens(_amountOut, _amountInMax, path, _to, block.timestamp.add(25));
        
        return true;
    }

}