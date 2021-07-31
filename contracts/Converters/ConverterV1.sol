pragma solidity 0.6.12;

import "../libraries/token/ERC20/IERC20.sol";
import "../InsureToken.sol";

import "../libraries/math/Math.sol";
import "../libraries/math/SafeMath.sol";
import "../libraries/utils/ReentrancyGuard.sol";
import "../interfaces/utils/ISwapRouter.sol";
import "../interfaces/utils/IQuoter.sol";

//InsureDAO util contract using Uniswap V2
contract ConverterV1{
    using SafeMath for uint256;

    ISwapRouter public UniswapV3 = ISwapRouter(0x273Edaa13C845F605b5886Dd66C89AB497A6B17b); //rinkeby
    IQuoter public Quoter = IQuoter(0x91a64CCaead471caFF912314E466D9CF7C55E0E8); //rinkeby
    IERC20 public WETH = IERC20(0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2); //rinkeby
    IERC20 public USDC = IERC20(0xeb8f08a975Ab53E34D8a0330E0D34de942C95926); //rinkyby
    
    InsureToken public insure_token;

    /// @dev The length of the bytes encoded address
    uint256 private constant ADDR_SIZE = 20;
    /// @dev The length of the bytes encoded fee
    uint256 private constant FEE_SIZE = 3;
    /// @dev The offset of a single token address and pool fee
    uint256 private constant NEXT_OFFSET = ADDR_SIZE + FEE_SIZE;

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

        bytes memory tokenA = abi.encode(address(USDC));
        bytes memory tokenB = abi.encode(address(insure_token));
        bytes memory fee = abi.encode(_amountIn * 3 / 1000);

        bytes memory path = new bytes(NEXT_OFFSET + ADDR_SIZE);
        assembly {
            mstore(add(path, 20), tokenA)
            mstore(add(path, 23), fee)
            mstore(add(path, 43), tokenB)
        }

        bytes memory data = abi.encode(path, _to);

        UniswapV3.uniswapV3SwapCallback(int256(_amountIn), 0, data);

        return true;
    }


    /***
    *@dev only be used in case of emergency_mint(). To know how many INSURE is required.
    */
    function getAmountsIn(uint256 _amountOut)external view returns(uint256){
        
        bytes memory tokenA = abi.encode(address(insure_token));
        bytes memory tokenB = abi.encode(address(USDC));
        bytes memory fee = abi.encode(_amountOut * 3 / 1000);

        bytes memory path = new bytes(NEXT_OFFSET + ADDR_SIZE);
        assembly {
            mstore(add(path, 20), tokenA)
            mstore(add(path, 23), fee)
            mstore(add(path, 43), tokenB)
        }

        uint256 amountIn = Quoter.quoteExactOutput(path, _amountOut);

        return amountIn;
    }

    /***
    *@dev only be used in case of emergency_mint(). Swap minted INSURE to USDC to make a payment.
    */
    function swap_insure_to_exact(uint256 _amountInMax, uint256 _amountOut, address _to)external returns (bool){
        //setup for swap
        require(insure_token.transferFrom(msg.sender, address(this), _amountInMax), 'transferFrom failed.');
        require(insure_token.approve(address(UniswapV3), _amountInMax), 'approve failed.');

        bytes memory tokenA = abi.encode(address(insure_token));
        bytes memory tokenB = abi.encode(address(USDC));
        bytes memory fee = abi.encode(_amountOut * 3 / 1000);

        bytes memory path = new bytes(NEXT_OFFSET + ADDR_SIZE);
        assembly {
            mstore(add(path, 20), tokenA)
            mstore(add(path, 23), fee)
            mstore(add(path, 43), tokenB)
        }

        bytes memory data = abi.encode(path, _to);

        UniswapV3.uniswapV3SwapCallback(int256(_amountOut), int256(_amountInMax), data);
        
        return true;
    }

}