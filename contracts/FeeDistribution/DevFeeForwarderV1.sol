pragma solidity ^0.7.5;
//SPDX-License-Identifier: MIT
/***
* DevFee Forwarder to gnosis multisig wallet of insureDAO;
* 
*/

import "../libraries/token/ERC20/IERC20.sol";

import "../libraries/math/Math.sol";
import "../libraries/math/SafeMath.sol";
import "../libraries/utils/ReentrancyGuard.sol";

contract DevFeeForwarder is ReentrancyGuard{
    using SafeMath for uint256;

    address public wallet; //gnosis multisig wallet

    function distribute(address _token)external returns(bool){
        //anyone can call this contract
        //collect _token.
        uint256 claimable = IERC20(_token).allowance(msg.sender, address(this));
        if(claimable > 0){
            require(IERC20(_token).transferFrom(msg.sender, address(this), claimable), 'transfer failed.');
        }

        //transfer to insureDAO multisig wallet. *only this part can be excuted if msg.sender approve 0
        uint256 amount = IERC20(_token).balanceOf(msg.sender);
        require(IERC20(_token).transferFrom(address(this), wallet, amount), 'transfer failed.');

        return true;
    }

}
