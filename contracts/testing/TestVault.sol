pragma solidity 0.8.10;
//SPDX-License-Identifier: MIT

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract TestVault {
    address token;

    constructor(address _token) {
        token = _token;
    }

    function withdrawAllAttribution(address _to) external returns (uint256) {
        uint256 amount = IERC20(token).balanceOf(address(this));
        IERC20(token).transfer(_to, amount);

        return amount;
    }
}
