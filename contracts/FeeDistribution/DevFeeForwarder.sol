pragma solidity 0.8.10;

/***
 *@title DevFeeForwarder
 *@author InsureDAO
 * SPDX-License-Identifier: MIT
 *@notice DevFee Forwarder to gnosis multisig wallet of insureDAO;
 */

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract DevFeeForwarder is ReentrancyGuard {
    using SafeERC20 for IERC20;

    address public wallet; //gnosis multisig wallet

    constructor(address _wallet) {
        require(_wallet != address(0), "zero address");
        wallet = _wallet;
    }

    function distribute(address _token) external returns (bool) {
        //anyone can call this contract

        require(_token != address(0), "zero address");

        //collect _token.
        uint256 claimable = IERC20(_token).allowance(msg.sender, address(this));
        if (claimable > 0) {
            IERC20(_token).safeTransferFrom(
                msg.sender,
                address(this),
                claimable
            );
        }

        //transfer all the token in this contract to the wallet.
        uint256 amount = IERC20(_token).balanceOf(address(this));
        IERC20(_token).safeTransfer(wallet, amount);

        return true;
    }
}
