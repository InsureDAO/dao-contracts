pragma solidity ^0.6.0;

/***
*@title Vesting Escrow
*@author InsureDAO
*SPDX-License-Identifier: MIT
*@notice Vests `InsureToken` tokens for multiple addresses over multiple vesting periods
*/

import "./libraries/math/Math.sol";
import "./libraries/math/SafeMath.sol";
import "./libraries/token/ERC20/IERC20.sol";
import "./libraries/utils/ReentrancyGuard.sol";

import "hardhat/console.sol";

contract VestingEscrow is ReentrancyGuard{
    using SafeMath for uint256;
    
    event Fund(address indexed recipient, uint256 amount);
    event Claim(address indexed recipient, uint256 claimed);
    event ToggleDisable(address recipient, bool disabled);
    event CommitOwnership(address admin);
    event ApplyOwnership(address admin);


    address public token; //address of $Insure
    uint256 public start_time;
    uint256 public end_time;
    mapping(address => uint256)public initial_locked;
    mapping(address => uint256)public total_claimed;

    uint256 public initial_locked_supply;
    uint256 public unallocated_supply;

    bool public can_disable;
    mapping(address => uint256) public disabled_at;

    address public admin;
    address public future_admin;

    bool public fund_admins_enabled;
    mapping(address => bool) public fund_admins;


    
    constructor(
        address _token,
        uint256 _start_time,
        uint256 _end_time,
        bool _can_disable, 
        address[4] memory _fund_admins
    )public {
        /***
        *@param _token Address of the ERC20 token being distributed
        *@param _start_time Timestamp at which the distribution starts. Should be in
        *    the future, so that we have enough time to VoteLock everyone
        *@param _end_time Time until everything should be vested
        *@param _can_disable Whether admin can disable accounts in this deployment.
        *@param _fund_admins Temporary admin accounts used only for funding
        */
        assert (_start_time >= block.timestamp);
        assert (_end_time > _start_time);

        token = _token;
        admin = msg.sender;
        start_time = _start_time;
        end_time = _end_time;
        can_disable = _can_disable;

        bool _fund_admins_enabled = false;
        for (uint256 i; i < _fund_admins.length; i++){
            address addr = _fund_admins[i];
            if (addr != address(0)){
                fund_admins[addr] = true;
                if (!_fund_admins_enabled){
                    _fund_admins_enabled = true;
                    fund_admins_enabled = true;
                }
            }
        }

    }

    
    function add_tokens(uint256 _amount)external{
        /***
        *@notice Transfer vestable tokens into the contract
        *@dev Handled separate from `fund` to reduce transaction count when using funding admins
        *@param _amount Number of tokens to transfer
        */
        require (msg.sender == admin, "dev admin only"); // dev admin only
        require (IERC20(token).transferFrom(msg.sender, address(this), _amount), "dev transfer failed");
        unallocated_supply = unallocated_supply.add(_amount);
    }

    function fund(address[100] memory _recipients, uint256[100] memory _amounts)external nonReentrant{
        /***
        *@notice Vest tokens for multiple recipients.
        *@param _recipients List of addresses to fund
        *@param _amounts Amount of vested tokens for each address
        */
        if (msg.sender != admin){
            require (fund_admins[msg.sender], "dev admin only");
            require (fund_admins_enabled, "dev fund admins disabled");
        }

        uint256 _total_amount = 0;
        for(uint256 i;  i< 100; i++){
            uint256 amount = _amounts[i];
            address recipient = _recipients[i];
            if (recipient == address(0)){
                break;
            }
            _total_amount = _total_amount.add(amount);
            initial_locked[recipient] = initial_locked[recipient].add(amount);
            emit Fund(recipient, amount);
        }

        initial_locked_supply = initial_locked_supply.add(_total_amount);
        unallocated_supply = unallocated_supply.sub(_total_amount);
    }


    
    function toggle_disable(address _recipient)external{
        /***
        *@notice Disable or re-enable a vested address's ability to claim tokens
        *@dev When disabled, the address is only unable to claim tokens which are still
        *    locked at the time of this call. It is not possible to block the claim
        *    of tokens which have already vested.
        *@param _recipient Address to disable or enable
        */
        require (msg.sender == admin, "dev: admin only");
        require (can_disable, "Cannot disable");

        bool is_disabled = disabled_at[_recipient] == 0;
        if (is_disabled){
            disabled_at[_recipient] = block.timestamp;
        }else{
            disabled_at[_recipient] = 0;
        }

        emit ToggleDisable(_recipient, is_disabled);
    }

    
    function disable_can_disable()external{
        /***
        *@notice Disable the ability to call `toggle_disable`
        */
        require (msg.sender == admin, "dev admin only");
        can_disable = false;
    }


    
    function disable_fund_admins()external{
        /***
        *@notice Disable the funding admin accounts
        */
        require (msg.sender == admin, "dev admin only");
        fund_admins_enabled = false;
    }
    
    function _total_vested_of(address _recipient, uint256 _time)internal view returns (uint256){
        /***
        * @notice Amount of unlocked token amount of _recipient at _time. (include claimed)
        */
        uint256 start = start_time;
        uint256 end = end_time;
        uint256 locked = initial_locked[_recipient];
        if (_time < start){
            return 0;
        }
        return min(locked.mul(_time.sub(start)).div(end.sub(start)), locked);
    }

    function _total_vested()internal view returns (uint256){
        uint256 start = start_time;
        uint256 end = end_time;
        uint256 locked = initial_locked_supply;

        if(block.timestamp < start){
            return 0;
        }else{
            return min(locked.mul(block.timestamp.sub(start)).div(end.sub(start)), locked); // when block.timestamp > end, return locked
        }
    }

    function vestedSupply()external view returns (uint256){
        /***
        *@notice Get the total number of tokens which have vested, that are held
        *        by this contract
        */
        return _total_vested();
    }
    
    function lockedSupply()external view returns (uint256){
        /***
        *@notice Get the total number of tokens which are still locked
        *        (have not yet vested)
        */
        return initial_locked_supply.sub(_total_vested());
    }

    function vestedOf(address _recipient)external view returns (uint256){
        /***
        *@notice Get the number of tokens which have vested for a given address
        *@param _recipient address to check
        */
        return _total_vested_of(_recipient, block.timestamp);
    }

    function balanceOf(address _recipient)external view returns (uint256){
        /***
        *@notice Get the number of unclaimed, vested tokens for a given address
        *@param _recipient address to check
        */
        return _total_vested_of(_recipient, block.timestamp).sub(total_claimed[_recipient]);
    }

    function lockedOf(address _recipient)external view returns (uint256){
        /***
        *@notice Get the number of locked tokens for a given address
        *@param _recipient address to check
        */
        return initial_locked[_recipient].sub(_total_vested_of(_recipient, block.timestamp));
    }

    function claim(address addr)external nonReentrant{
        /***
        *@notice Claim tokens which have vested
        *@param addr Address to claim tokens for
        */
        uint256 t = disabled_at[addr];
        if (t == 0){
            t = block.timestamp;
        }
        uint256 claimable = _total_vested_of(addr, t).sub(total_claimed[addr]);

        total_claimed[addr] = total_claimed[addr].add(claimable);
        assert (IERC20(token).transfer(addr, claimable));

        emit Claim(addr, claimable);
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


    
    function apply_transfer_ownership()external returns (bool){
        /***
        *@notice Apply pending ownership transfer
        */
        require (msg.sender == admin, "dev: admin only");
        address _admin = future_admin;
        require (_admin != address(0), "dev: admin not set");
        admin = _admin;
        emit ApplyOwnership(_admin);

        return true;
    }

    function min(uint256 a, uint256 b) internal pure returns (uint256) {
        return a < b ? a : b;
    }
}