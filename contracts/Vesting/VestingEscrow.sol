pragma solidity 0.8.10;

/***
 *@title Vesting Escrow
 *@author InsureDAO
 * SPDX-License-Identifier: MIT
 *@notice Vests `InsureToken` tokens for multiple addresses over multiple vesting periods
 */

//libraries
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract VestingEscrow is ReentrancyGuard {
    using SafeERC20 for IERC20;

    event Fund(address indexed recipient, uint256 amount);
    event Claim(address indexed recipient, uint256 claimed);
    event RugPull(address recipient, uint256 rugged);
    event ToggleDisable(address recipient, bool disabled);
    event CommitOwnership(address admin);
    event AcceptOwnership(address admin);

    address public token; //address of $INSURE
    uint256 public start_time;
    uint256 public end_time;
    mapping(address => uint256) public initial_locked;
    mapping(address => uint256) public total_claimed;
    mapping(address => bool) public is_ragged;

    uint256 public initial_locked_supply;
    uint256 public unallocated_supply;
    uint256 public rugged_amount;

    bool public can_disable;
    mapping(address => uint256) public disabled_at;

    address public admin;
    address public future_admin;

    bool public fund_admins_enabled;
    mapping(address => bool) public fund_admins;

    /***
     *@param _token Address of the ERC20 token being distributed
     *@param _start_time Timestamp at which the distribution starts. Should be in
     *    the future, so that we have enough time to VoteLock everyone
     *@param _end_time Time until everything should be vested
     *@param _can_disable Whether admin can disable accounts in this deployment.
     *@param _fund_admins Temporary admin accounts used only for funding
     */
    constructor(
        address _token,
        uint256 _start_time,
        uint256 _end_time,
        bool _can_disable,
        address[4] memory _fund_admins
    ) {
        require(_start_time >= block.timestamp);
        require(_end_time > _start_time);

        token = _token;
        admin = msg.sender;
        start_time = _start_time;
        end_time = _end_time;
        can_disable = _can_disable;

        bool _fund_admins_enabled = false;
        uint256 _length = _fund_admins.length;
        for (uint256 i; i < _length; ) {
            address addr = _fund_admins[i];
            if (addr != address(0)) {
                fund_admins[addr] = true;
                if (!_fund_admins_enabled) {
                    _fund_admins_enabled = true;
                    fund_admins_enabled = true;
                }
            }
            unchecked {
                ++i;
            }
        }
    }

    /***
     *@notice Transfer vestable tokens into the contract
     *@dev Handled separate from `fund` to reduce transaction count when using funding admins
     *@param _amount Number of tokens to transfer
     */
    function add_tokens(uint256 _amount) external {
        require(msg.sender == admin, "dev admin only"); // dev admin only
        IERC20(token).safeTransferFrom(msg.sender, address(this), _amount);
        unallocated_supply += _amount;
    }

    /***
     *@notice Vest tokens for multiple recipients.
     *@param _recipients List of addresses to fund
     *@param _amounts Amount of vested tokens for each address
     */
    function fund(address[100] memory _recipients, uint256[100] memory _amounts)
        external
        nonReentrant
    {
        if (msg.sender != admin) {
            require(fund_admins[msg.sender], "dev admin only");
            require(fund_admins_enabled, "dev fund admins disabled");
        }

        uint256 _total_amount = 0;
        for (uint256 i; i < 100; i++) {
            uint256 amount = _amounts[i];
            address recipient = _recipients[i];
            if (recipient == address(0)) {
                break;
            }
            _total_amount += amount;
            initial_locked[recipient] += amount;
            emit Fund(recipient, amount);
        }

        initial_locked_supply += _total_amount;
        unallocated_supply -= _total_amount;
    }

    /***
     *@notice Disable further flow of tokens and clawback the unvested part to admin
     */
    function rug_pull(address _target) external {
        require(msg.sender == admin, "onlyOwner");

        uint256 raggable = initial_locked[_target] -
            _total_vested_of(_target, block.timestamp); //all unvested token

        is_ragged[_target] = true;
        disabled_at[_target] = block.timestamp; //never be updated later on.

        rugged_amount += raggable;

        require(IERC20(token).transfer(admin, raggable));

        emit RugPull(admin, raggable);
    }

    /***
     *@notice Disable or re-enable a vested address's ability to claim tokens
     *@dev When disabled, the address is only unable to claim tokens which are still
     *    locked at the time of this call. It is not possible to block the claim
     *    of tokens which have already vested.
     *@param _recipient Address to disable or enable
     */
    function toggle_disable(address _recipient) external {
        require(msg.sender == admin, "onlyOwner");
        require(can_disable, "Cannot disable");
        require(!is_ragged[_recipient], "is rugged");

        bool is_disabled = disabled_at[_recipient] == 0;
        if (is_disabled) {
            disabled_at[_recipient] = block.timestamp;
        } else {
            disabled_at[_recipient] = 0;
        }

        emit ToggleDisable(_recipient, is_disabled);
    }

    /***
     *@notice Disable the ability to call `toggle_disable`
     */
    function disable_can_disable() external {
        require(msg.sender == admin, "dev admin only");
        can_disable = false;
    }

    /***
     *@notice Disable the funding admin accounts
     */
    function disable_fund_admins() external {
        require(msg.sender == admin, "dev admin only");
        fund_admins_enabled = false;
    }

    /***
     * @notice Amount of unlocked token amount of _recipient at _time. (include claimed)
     */
    function _total_vested_of(address _recipient, uint256 _time)
        internal
        view
        returns (uint256)
    {
        uint256 start = start_time;
        uint256 end = end_time;
        uint256 locked = initial_locked[_recipient];
        if (_time < start) {
            return 0;
        }
        return min((locked * (_time - start)) / (end - start), locked);
    }

    function _total_vested() internal view returns (uint256) {
        uint256 start = start_time;
        uint256 end = end_time;
        uint256 locked = initial_locked_supply;

        if (block.timestamp < start) {
            return 0;
        } else {
            return
                min(
                    (locked * (block.timestamp - start)) / (end - start),
                    locked
                ); // when block.timestamp > end, return locked
        }
    }

    /***
     *@notice Get the total number of tokens which have vested, that are held
     *        by this contract
     */
    function vestedSupply() external view returns (uint256) {
        return _total_vested();
    }

    /***
     *@notice Get the total number of tokens which are still locked
     *        (have not yet vested)
     */
    function lockedSupply() external view returns (uint256) {
        return initial_locked_supply - _total_vested();
    }

    /***
     *@notice Get the number of tokens which have vested for a given address
     *@param _recipient address to check
     */
    function vestedOf(address _recipient) external view returns (uint256) {
        uint256 t = disabled_at[_recipient];
        if (t == 0) {
            t = block.timestamp;
        }

        return _total_vested_of(_recipient, t);
    }

    /***
     *@notice Get the number of unclaimed, vested tokens for a given address
     *@param _recipient address to check
     */
    function balanceOf(address _recipient) external view returns (uint256) {
        uint256 t = disabled_at[_recipient];
        if (t == 0) {
            t = block.timestamp;
        }

        return _total_vested_of(_recipient, t) - total_claimed[_recipient];
    }

    /***
     *@notice Get the number of locked tokens for a given address
     *@param _recipient address to check
     */
    function lockedOf(address _recipient) external view returns (uint256) {
        if (is_ragged[_recipient] == true) {
            return 0;
        } else {
            return
                initial_locked[_recipient] -
                _total_vested_of(_recipient, block.timestamp);
        }
    }

    /***
     *@notice Claim tokens which have vested
     *@param addr Address to claim tokens for
     */
    function claim(address addr) external nonReentrant {
        uint256 t = disabled_at[addr];
        if (t == 0) {
            t = block.timestamp;
        }
        uint256 claimable = _total_vested_of(addr, t) - total_claimed[addr];

        total_claimed[addr] += claimable;
        require(IERC20(token).transfer(addr, claimable));

        emit Claim(addr, claimable);
    }

    /***
     *@notice Transfer ownership of GaugeController to `addr`
     *@param addr Address to have ownership transferred to
     */
    function commit_transfer_ownership(address addr) external returns (bool) {
        require(msg.sender == admin, "onlyOwner");
        future_admin = addr;
        emit CommitOwnership(addr);

        return true;
    }

    /***
     *@notice Accept a transfer of ownership
     *@return bool success
     */
    function accept_transfer_ownership() external {
        address _future_admin = future_admin;
        require(address(msg.sender) == _future_admin, "onlyFutureOwner");
        admin = _future_admin;
        emit AcceptOwnership(_future_admin);
    }

    function min(uint256 a, uint256 b) internal pure returns (uint256) {
        return a < b ? a : b;
    }
}
