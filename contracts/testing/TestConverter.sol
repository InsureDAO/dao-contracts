pragma solidity 0.8.7;
//SPDX-License-Identifier: MIT

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../InsureToken.sol";

import "@openzeppelin/contracts/utils/math/Math.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "../interfaces/utils/IUniswapV2Router02.sol";

//Using Uniswap V2
//All token's are 18 decimals.
contract TestConverter{
    using SafeMath for uint256;
    InsureToken public insure_token;

    constructor(address _insure){
        insure_token = InsureToken(_insure);
    }
    

    function getAmountsIn(uint256 _amountOut)external pure returns(uint256){
        return 55;
    }

    function swap_insure_to_exact(uint256 _amountInMax, uint256 _amountOut, address _to)external{
        require(insure_token.transferFrom(msg.sender, address(this), _amountInMax), 'transferFrom failed.');
    }

}