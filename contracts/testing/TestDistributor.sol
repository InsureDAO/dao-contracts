pragma solidity 0.6.12;
//SPDX-License-Identifier: MIT

import "../libraries/token/ERC20/IERC20.sol";

import "../libraries/math/Math.sol";
import "../libraries/math/SafeMath.sol";
import "../libraries/utils/ReentrancyGuard.sol";

contract TestDistributor is ReentrancyGuard{
    using SafeMath for uint256;

    address token;

    constructor(address _token)public{
        token = _token;
    }

    function distribute(address _token)external returns(bool){
        if(_token == token){
            uint256 claimable = IERC20(_token).allowance(msg.sender, address(this));
            require(claimable > 0);
            require(IERC20(_token).transferFrom(msg.sender, address(this), claimable), 'transfer failed.');

            return true;
        }else{
            //made to intentionally make fail for the tests.
            return false;
        }
    }

}