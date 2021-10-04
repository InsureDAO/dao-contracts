pragma solidity 0.8.7;

/***
*@title Simple Vesting Escrow
*@author InsureDAO
* SPDX-License-Identifier: MIT
*@notice Vests `InsureToken` tokens for a single address
*@dev Intended to be deployed many times via `VotingEscrowFactory`
*/

//libraries
import "@openzeppelin/contracts/utils/math/Math.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";


contract VestingEscrowSimple is ReentrancyGuard{
    using SafeMath for uint256;


    event Fund(address indexed recipient, uint256 amount);
    event Claim(address indexed recipient, uint256 claimed);
    event ToggleDisable(address recipient, bool disabled);
    event CommitOwnership(address admin);
    event AcceptOwnership(address admin);


    address public token;
    uint256 public start_time;
    uint256 public end_time;
    mapping(address => uint256) public initial_locked;
    mapping(address => uint256) public total_claimed;

    uint256 public initial_locked_supply;

    bool public can_disable;
    mapping(address => uint256)public disabled_at;

    address public admin;
    address public future_admin;

    bool public initialized;


    constructor(){}

    function initialize(
        address _admin,
        address _token,
        address _recipient,
        uint256 _amount,
        uint256 _start_time,
        uint256 _end_time,
        bool _can_disable
    )external nonReentrant returns(bool){
        /***
        *@notice Initialize the contract.
        *@dev This function is seperate from `__init__` because of the factory pattern
        *    used in `VestingEscrowFactory.deploy_vesting_contract`. It may be called
        *    once per deployment.
        *@param _admin Admin address
        *@param _token Address of the ERC20 token being distributed
        *@param _recipient Address to vest tokens for
        *@param _amount Amount of tokens being vested for `_recipient`
        *@param _start_time Epoch time at which token distribution starts
        *@param _end_time Time until everything should be vested
        *@param _can_disable Can admin disable recipient's ability to claim tokens?
        */
        
        require (!initialized, "dev: can only initialize once");

        token = _token;
        admin = _admin;
        start_time = _start_time;
        end_time = _end_time;
        can_disable = _can_disable;

        require (IERC20(_token).transferFrom(msg.sender, address(this), _amount), "dev: not allowed");//Transfer token from VestingFactory to this contract.

        initial_locked[_recipient] = _amount;
        initial_locked_supply = _amount;
        emit Fund(_recipient, _amount);

        initialized = true;
        return true;
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
        require(can_disable, "Cannot disable");

        bool is_disabled = disabled_at[_recipient] == 0;
        if (is_disabled){
            disabled_at[_recipient] = block.timestamp;
        }else{
            disabled_at[_recipient] = 0;
        }

        emit ToggleDisable(_recipient, is_disabled);
    }

    function disable_can_disable()external {
        /***
        *@notice Disable the ability to call `toggle_disable`
        */
        require (msg.sender == admin, "dev: admin only");
        can_disable = false;
    }

    function _total_vested_of(address _recipient, uint256 _time)internal view returns(uint256){
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
        if (block.timestamp < start){
            return 0;
        }
        return min(locked.mul(block.timestamp.sub(start)).div(end.sub(start)), locked);
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
        @notice Get the number of unclaimed, vested tokens for a given address
        @param _recipient address to check
        */
        return _total_vested_of(_recipient, block.timestamp).sub(total_claimed[_recipient]);
    }

    function lockedOf(address _recipient)external view returns (uint256){
        /***
        @notice Get the number of locked tokens for a given address
        @param _recipient address to check
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
        assert(IERC20(token).transfer(addr, claimable));

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

    function min(uint256 a, uint256 b) internal pure returns (uint256) {
        return a < b ? a : b;
    }
}
