pragma solidity 0.8.10;

/***
 *@title CDSFeeForwarder
 *@author InsureDAO
 * SPDX-License-Identifier: MIT
 *@notice
 */

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract CDSFeeForwarder is Ownable {
    using SafeERC20 for IERC20;

    address public recipient;
    address public token;

    constructor(address _token, address _recipient) {
        require(_token != address(0), "zero address");
        require(_recipient != address(0), "zero address");

        recipient = _recipient;
        token = _token;
    }

    /***
     *@notice transfer allowed "token" to the "recipient"
     */
    function distribute() external onlyOwner returns (bool) {
        uint256 claimable = IERC20(token).allowance(msg.sender, address(this));
        if (claimable > 0) {
            IERC20(token).safeTransferFrom(msg.sender, recipient, claimable);
        }

        return true;
    }

    /***
     *@notice transfer arbitrary token to arbitrary address.
     *@dev This can be useful when Community wants to utilize CDS fund to something else.
     *@param _token token address to be transfered
     *@param _destination address of the token destination
     */
    function salvage(address _token, address _destination)
        external
        onlyOwner
        returns (bool)
    {
        require(_token != address(0), "zero address");
        //*recipient can be address(0)

        uint256 amount = IERC20(_token).balanceOf(address(this));

        if (amount > 0) {
            IERC20(_token).safeTransfer(_destination, amount);
        }

        return true;
    }
}
