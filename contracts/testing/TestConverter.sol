pragma solidity 0.8.7;
//SPDX-License-Identifier: MIT

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "../InsureToken.sol";

import "@openzeppelin/contracts/utils/math/Math.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "../interfaces/utils/IUniswapV2Router02.sol";

//Using Uniswap V2
//All token's are 18 decimals.
contract TestConverter{
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    InsureToken public insure_token;

    constructor(address _insure){
        insure_token = InsureToken(_insure);
    }

    function swap_exact_to_insure(address _token, uint256 _amountIn, address _to)external returns(bool){
        //setup for swap
        IERC20(_token).safeTransferFrom(msg.sender, address(this), _amountIn);

        //simulate this function send INSURE token to _to
        uint256 insure_amount = insure_token.balanceOf(address(this));
        if(insure_amount>0){
            insure_token.transfer(_to, insure_amount);
        }

        return true;
    }
    

    function getAmountsIn(uint256 _amountOut)external pure returns(uint256){
        return 55;
    }

    function swap_insure_to_exact(uint256 _amountInMax, uint256 _amountOut, address _to)external returns(bool){
        require(insure_token.transferFrom(msg.sender, address(this), _amountInMax), 'transferFrom failed.');

        return true;
    }

}