pragma solidity 0.8.10;
//SPDX-License-Identifier: MIT

import "../interfaces/dao/ICollateralManager.sol";
import "../VotingEscrow.sol";

contract TestCollateralManager is ICollateralManager {
    address public voting_escrow;
    address public admin;

    constructor(address _addr) {
        admin = msg.sender;
        voting_escrow = _addr;
    }

    function checkStatus(address _addr) external override returns (bool) {
        return true;
    }

    function force_unlock(address _target) external {
        require(msg.sender == admin, "only admin");
        VotingEscrow(voting_escrow).force_unlock(_target);
    }
}
