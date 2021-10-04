pragma solidity ^0.7.5;

/***
*@title Vesting Escrow Factory
*@author InsureDAO
* SPDX-License-Identifier: MIT
*@notice Stores and distributes `InsureToken` tokens by deploying `VestingEscrowSimple` contracts
*/

//dao-contracts
import "./VestingEscrowSimple.sol"; //For the flatten file readability, import the contract directly.

//libraries
import "./libraries/math/SafeMath.sol";
import "./libraries/math/SignedSafeMath.sol";
import "./libraries/token/ERC20/IERC20.sol";


contract VestingEscrowFactory{
    uint256 constant MIN_VESTING_DURATION = 86400 * 365; //1year

    event CommitOwnership(address admin);
    event AcceptOwnership(address admin);

    address public admin;
    address public future_admin;
    address public target;
    address public latest_deployed_address; //For test

    constructor(address _target ,address _admin){
        /***
        *@notice Contract constructor
        *@dev Prior to deployment you must deploy one copy of `VestingEscrowSimple` which
        *    is used as a library for vesting contracts deployed by this factory
        *@param _target `VestingEscrowSimple` contract address
        */
        target = _target;
        admin = _admin;
    }

    function deploy_vesting_contract(
        address _token,
        address _recipient,
        uint256 _amount,
        bool _can_disable,
        uint256 _vesting_duration,
        uint256 _vesting_start //originally, uint256 _vesting_start = block.timestamp
    )external returns (address){
        /***
        *@notice Deploy a new vesting contract
        *@dev Each contract holds tokens which vest for a single account. Tokens
        *    must be sent to this contract via the regular `ERC20.transfer` method
        *    prior to calling this method.
        *@param _token Address of the ERC20 token being distributed
        *@param _recipient Address to vest tokens for
        *@param _amount Amount of tokens being vested for `_recipient`
        *@param _can_disable Can admin disable recipient's ability to claim tokens?
        *@param _vesting_duration Time period over which tokens are released
        *@param _vesting_start Epoch time when tokens begin to vest
        */

        if(_vesting_start == 0){//added by InsureDAO
            _vesting_start = block.timestamp; 
        }

        require (msg.sender == admin, "dev: admin only");
        require (_vesting_start >= block.timestamp, "dev: start time too soon");
        require (_vesting_duration >= MIN_VESTING_DURATION, "dev: duration too short");
        require (_token != address(0), "dev: zero address");

        VestingEscrowSimple _contract = VestingEscrowSimple(_createClone(address(target)));

        require (IERC20(_token).approve(address(_contract), _amount), "dev: approve failed");
        _contract.initialize(
            admin,
            _token,
            _recipient,
            _amount,
            _vesting_start,
            _vesting_start + _vesting_duration,
            _can_disable
        );
        latest_deployed_address = address(_contract);
        return address(_contract);

    }

    function _createClone(address _target) internal returns (address result) {
        // convert address to bytes20 for assembly use
        bytes20 targetBytes = bytes20(_target);
        assembly {
            // allocate clone memory
            let clone := mload(0x40)
            // store initial portion of the delegation contract code in bytes form
            mstore(
                clone,
                0x3d602d80600a3d3981f3363d3d373d3d3d363d73000000000000000000000000
            )
            // store the provided address
            mstore(add(clone, 0x14), targetBytes)
            // store the remaining delegation contract code
            mstore(
                add(clone, 0x28),
                0x5af43d82803e903d91602b57fd5bf30000000000000000000000000000000000
            )
            // create the actual delegate contract reference and return its address
            result := create(0, clone, 0x37)
        }
    }

    function commit_transfer_ownership(address addr)external returns (bool){
        /***
        *@notice Transfer ownership of GaugeController to `addr`
        *@param addr Address to have ownership transferred to
        */
        require (msg.sender == admin, "dev: admin only");
        future_admin = addr;
        emit CommitOwnership(addr);

        return true;
    }

    function accept_transfer_ownership()external returns (bool){
        /***
        *@notice Accept a transfer of ownership
        *@return bool success
        */
        require(address(msg.sender) == future_admin, "dev: future_admin only");

        admin = future_admin;

        emit AcceptOwnership(admin);

        return true;
    }
}