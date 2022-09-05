pragma solidity 0.8.10;
//SPDX-License-Identifier: MIT

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "@openzeppelin/contracts/utils/math/Math.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract TestDistributor is ReentrancyGuard {
    using SafeMath for uint256;

    address token;

    constructor(address _token) {
        token = _token;
    }

    function distribute(address _token) external returns (bool) {
        if (_token == token) {
            uint256 claimable = IERC20(_token).allowance(
                msg.sender,
                address(this)
            );
            require(claimable > 0);
            require(
                IERC20(_token).transferFrom(
                    msg.sender,
                    address(this),
                    claimable
                ),
                "transfer failed."
            );

            return true;
        } else {
            //made to intentionally make fail for the tests.
            return false;
        }
    }
}
