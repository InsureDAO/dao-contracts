pragma solidity 0.8.10;

/***
 *@title ConverterV1
 *@author InsureDAO
 * SPDX-License-Identifier: MIT
 *@notice utility contract for token exchange using UniswapV2
 */

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "../../InsureToken.sol";

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "../../interfaces/utils/IUniswapV2Router02.sol";

contract ConverterV1 {
    using SafeERC20 for IERC20;

    IUniswapV2Router02 public UniswapV2 =
        IUniswapV2Router02(0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D); //rinkeby
    InsureToken public insure_token;
    IERC20 public WETH = IERC20(0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2); //rinkeby
    IERC20 public USDC = IERC20(0xeb8f08a975Ab53E34D8a0330E0D34de942C95926); //rinkyby

    constructor(address _insure) {
        insure_token = InsureToken(_insure);
    }

    function swap_exact_to_insure(
        address _token,
        uint256 _amountIn,
        address _to
    ) external returns (bool) {
        /***
         *@notice Buy back insure by ARBITRARY token.
         *@param _token address of token to be used for exchange
         *@param _amountIn amount of _token to be used for exchange
         *@param _to address where exchanged INSURE goes
         */

        //setup for swap
        IERC20(_token).safeTransferFrom(msg.sender, address(this), _amountIn);
        IERC20(_token).safeApprove(address(UniswapV2), _amountIn);

        address[] memory path = new address[](3);
        path[0] = address(_token);
        path[1] = address(WETH);
        path[2] = address(insure_token); //insure token

        uint256 _deadline;
        unchecked {
            _deadline = block.timestamp + 25;
        }
        //swap
        UniswapV2.swapExactTokensForTokens(_amountIn, 0, path, _to, _deadline);

        return true;
    }

    function getAmountsIn(uint256 _amountOut) external view returns (uint256) {
        /***
         *@notice get INSURE token required to get _amountOut of USDC
         *@param _amountOut amount of USDC needed
         *@dev only be used for emergency_mint() to know how many INSURE is required.
         */
        address[] memory path = new address[](3);
        path[0] = address(insure_token);
        path[1] = address(WETH);
        path[2] = address(USDC);

        uint256[] memory amountsIn = UniswapV2.getAmountsIn(_amountOut, path);
        return amountsIn[0]; //required Insure Token
    }

    function swap_insure_to_exact(
        uint256 _amountInMax,
        uint256 _amountOut,
        address _to
    ) external returns (bool) {
        /***
         *@notice swap INSURE token to exact amount of USDC.
         *@dev only be used in case of emergency_mint(). Swap minted INSURE to USDC to make a payment.
         */

        //setup for swap
        require(
            insure_token.transferFrom(msg.sender, address(this), _amountInMax),
            "transferFrom failed."
        );
        require(
            insure_token.approve(address(UniswapV2), _amountInMax),
            "approve failed."
        );

        address[] memory path = new address[](3);
        path[0] = address(insure_token); //insure token
        path[1] = address(WETH);
        path[2] = address(USDC);

        uint256 _deadline;
        unchecked {
            UniswapV2.swapTokensForExactTokens(
                _amountOut,
                _amountInMax,
                path,
                _to,
                block.timestamp + 25
            );
        }

        return true;
    }
}
