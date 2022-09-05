pragma solidity 0.8.10;
//SPDX-License-Identifier: MIT

import "../InsureToken.sol";
import "../interfaces/dao/IConverter.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract TestConverter is IConverter {
    InsureToken public insure_token;

    constructor(address _insure) {
        insure_token = InsureToken(_insure);
    }

    function swap_exact_to_insure(
        address _token,
        uint256 _amountIn,
        address _to
    ) external override returns (bool) {
        //setup for swap
        IERC20(_token).transferFrom(msg.sender, address(this), _amountIn);

        //simulate this function send INSURE token to _to
        uint256 insure_amount = insure_token.balanceOf(address(this));
        if (insure_amount > 0) {
            insure_token.transfer(_to, insure_amount);
        }

        return true;
    }

    function getAmountsIn(address _tokenOut, uint256 _amountOut)
        external
        pure
        override
        returns (uint256)
    {
        return 55;
    }

    function swap_insure_to_exact(
        address _tokenOut,
        uint256 _amountOut,
        uint256 _amountInMax,
        address _to
    ) external override returns (bool) {
        require(
            insure_token.transferFrom(msg.sender, address(this), _amountInMax),
            "transferFrom failed."
        );

        return true;
    }
}
