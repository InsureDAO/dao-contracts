pragma solidity 0.8.7;
//SPDX-License-Identifier: MIT
/***
* DevFee Forwarder to gnosis multisig wallet of insureDAO;
* 
*/

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "@openzeppelin/contracts/utils/math/Math.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract DevFeeForwarder is ReentrancyGuard{
    using SafeMath for uint256;

    address public wallet; //gnosis multisig wallet

    constructor(address _wallet){
        wallet = _wallet;
    }

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
