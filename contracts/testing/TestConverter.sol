pragma solidity >=0.7.5;

import "../libraries/token/ERC20/IERC20.sol";
import "../InsureToken.sol";

import "../libraries/math/Math.sol";
import "../libraries/math/SafeMath.sol";
import "../libraries/utils/ReentrancyGuard.sol";
import "../interfaces/utils/ISwapRouter.sol";

//Using Uniswap V2
//All token's are 18 decimals.
contract TestConverter{
    using SafeMath for uint256;
    InsureToken public insure_token;

    constructor(address _insure)public{
        insure_token = InsureToken(_insure);
    }
    

    function getAmountsIn(uint256 _amountOut)external pure returns(uint256){
        return 55;
    }

    function swap_insure_to_exact(uint256 _amountInMax, uint256 _amountOut, address _to)external{
        require(insure_token.transferFrom(msg.sender, address(this), _amountInMax), 'transferFrom failed.');
    }

}