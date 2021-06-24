pragma solidity ^0.6.0;
//SPDX-License-Identifier: MIT
/***
* Buy back and burn Insure Token from DAI/Insure pool on Uniswap.
*/

import "../libraries/token/ERC20/IERC20.sol";

import "../libraries/math/Math.sol";
import "../libraries/math/SafeMath.sol";
import "../libraries/utils/ReentrancyGuard.sol";
import "../interfaces/IUniswapV2Router01.sol";
import "../ConverterV1.sol";

interface BURN{
     function burn(uint256 _value)external returns(bool);
}

contract FeeDistributionV1{
     using SafeMath for uint256;

     address insure_token;
     ConverterV1 public converter;
     address constant public UniswapV2Router01 = address(0xf164fC0Ec4E93095b804a4795bBe1e041497b92a);
     

     constructor(address _insure_token, address _converter)public{
          insure_token = _insure_token;
          converter = ConverterV1(_converter);
     }

     function distribute(address _token)external returns(bool){
          /***
          *@param _token DAI address
          *@dev transfer all approved amount of _token by msg.sender to this contract.
          *     Then, immediately exequte buying back Insure tokens from UniswapV2 and burn them.
          *     It's intended that it's called by PoolProxy with DAI, but it also works that calling this function from any accounts with any token when enough amount of the token is approved.
          */

          //collect _token.
          uint256 claimable = IERC20(_token).allowance(msg.sender, address(this));
          require(claimable > 0);
          require(IERC20(_token).transferFrom(msg.sender, address(this), claimable), 'transfer failed.');

          //exchange _token to Insure on Uniswap.
          uint256 amount = IERC20(_token).balanceOf(address(this));
          require(IERC20(_token).approve(address(converter), amount), 'approve failed.');

          require(converter.swap_exact_to_insure(amount, address(this)), 'swap failed');

          //burn Sure if >0
          uint256 burn_amount = IERC20(insure_token).balanceOf(address(this));
          if(burn_amount > 0){
               BURN(insure_token).burn(burn_amount);
          }

          return true;
     } 

    
}