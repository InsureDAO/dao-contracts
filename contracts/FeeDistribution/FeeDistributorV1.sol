pragma solidity 0.8.7;

/***
*@title ConverterV1
*@author InsureDAO
* SPDX-License-Identifier: MIT
*@notice Buy back INSURE by arbitrary token and burn.
*/

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "@openzeppelin/contracts/utils/math/Math.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "../Converters/ConverterV1.sol";

interface BURN{
     function burn(uint256 _value)external returns(bool);
}

contract FeeDistributionV1{
     using SafeMath for uint256;
     using SafeERC20 for IERC20;

     address insure_token;
     ConverterV1 public converter;
     

     constructor(address _insure_token, address _converter){
          //input check
          require(_insure_token != address(0), "zero-address");
          require(_converter != address(0), "zero-address");
          
          insure_token = _insure_token;
          converter = ConverterV1(_converter);
     }

     function distribute(address _token)external returns(bool){
          /***
          *@notice Buy back INSURE by arbitrary token and burn.
          *@param _token address of token to be used for exchange
          */

          //collect _token.
          uint256 claimable = IERC20(_token).allowance(msg.sender, address(this));
          require(claimable > 0);
          IERC20(_token).safeTransferFrom(msg.sender, address(this), claimable);

          //exchange _token to INSURE using Converter contract.
          uint256 amount = IERC20(_token).balanceOf(address(this));
          IERC20(_token).safeApprove(address(converter), amount);

          require(converter.swap_exact_to_insure(_token, amount, address(this)), 'swap failed');

          //burn INSURE if >0
          uint256 burn_amount = IERC20(insure_token).balanceOf(address(this));
          if(burn_amount > 0){
               BURN(insure_token).burn(burn_amount);
          }

          return true;
     } 

    
}