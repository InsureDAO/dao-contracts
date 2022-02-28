pragma solidity 0.8.10;

/***
 *@title Reward Gauge
 *@author InsureDAO
 * SPDX-License-Identifier: MIT
 *@notice reward for veINSURE
 */

//dao-contracts
import "../interfaces/dao/IGaugeController.sol";
import "../interfaces/dao/IInsureToken.sol";
import "../interfaces/dao/IMinter.sol";
import "../interfaces/dao/IVotingEscrow.sol";

import "../interfaces/pool/IOwnership.sol";

//libraries
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract RewardGauge is ReentrancyGuard {
    event Deposit(address indexed provider, uint256 value);
    event Withdraw(address indexed provider, uint256 value);
    event UpdateLiquidityLimit(
        address user,
        uint256 working_supply
    );

    uint256 constant WEEK = 604800;

    //Contracts
    IMinter public minter;
    IInsureToken public insure_token;
    IGaugeController public controller;
    IVotingEscrow public voting_escrow;

    uint256 public future_epoch_time;

    mapping(address => uint256) public working_balances;
    uint256 public working_supply;

    // The goal is to be able to calculate ∫(rate * balance / totalSupply dt) from 0 till checkpoint
    // All values are kept in units of being multiplied by 1e18
    uint256 public period; //modified from "int256 public period" since it never be minus.

    uint256[100000000000000000000000000000] public period_timestamp;

    // 1e18 * ∫(rate(t) / totalSupply(t) dt) from 0 till checkpoint
    uint256[100000000000000000000000000000] public integrate_inv_supply; // bump epoch when rate() changes. Iis(t)=int(r'(t)/S(t))dt (from CurveDAO whitepaper)

    // 1e18 * ∫(rate(t) / totalSupply(t) dt) from (last_action) till checkpoint
    mapping(address => uint256) public integrate_inv_supply_of;
    mapping(address => uint256) public integrate_checkpoint_of;

    // ∫(balance * rate(t) / totalSupply(t) dt) from 0 till checkpoint
    // Units rate * t = already number of coins per address to issue
    mapping(address => uint256) public integrate_fraction; //Mintable Token amount (include minted amount)

    uint256 public inflation_rate;
    bool public is_killed;

    IOwnership public immutable ownership;

    modifier onlyOwner() {
        require(
            ownership.owner() == msg.sender,
            "Caller is not allowed to operate"
        );
        _;
    }

    /***
     *@notice Contract constructor
     *@param _lp_addr Liquidity Pool contract address
     *@param _minter Minter contract address
     *@param _admin Admin who can kill the gauge
     */
    constructor(
        address _minter,
        address _ownership
    ) {
        require(_minter != address(0));

        minter = IMinter(_minter);
        ownership = IOwnership(_ownership);
        insure_token = IInsureToken(minter.insure_token());
        controller = IGaugeController(minter.gauge_controller());
        voting_escrow = IVotingEscrow(controller.get_voting_escrow());

        period_timestamp[0] = block.timestamp;
        inflation_rate = insure_token.rate();
        future_epoch_time = insure_token.future_epoch_time_write();
    }

    /***
     *@notice Calculate limits which depend on the amount of INSURE Token per-user.
     *        Effectively it calculates working balances to apply amplification
     *        of INSURE production by INSURE
     *@param _addr User address
     */
    function _update_liquidity_limit(
        address _addr
    ) internal {
        // To be called after totalSupply is updated
        uint256 _voting_balance = voting_escrow.balanceOf(
            _addr,
            block.timestamp
        );

        uint256 _old_bal = working_balances[_addr];
        working_balances[_addr] = _voting_balance;
        uint256 _working_supply = working_supply + _voting_balance - _old_bal;
        working_supply = _working_supply;

        emit UpdateLiquidityLimit(
            _addr,
            _working_supply
        );
    }

    //to avoid "stack too deep"
    struct CheckPointParameters {
        uint256 period;
        uint256 period_time;
        uint256 integrate_inv_supply;
        uint256 rate;
        uint256 new_rate;
        uint256 prev_future_epoch;
        uint256 working_balance;
        uint256 working_supply;
    }

    /***
     *@notice Checkpoint for a user
     *@param _addr User address
     *
     *This function does,
     *1. Calculate Iis for All: Calc and add Iis for every week. Iis only increses over time.
     *2. Calculate Iu for _addr: Calc by (defferece between Iis(last time) and Iis(this time))* LP deposit amount of _addr(include INSURE locking boost)
     *
     * working_supply & working_balance = total_supply & total_balance with INSURE locking boost。
     * Check whitepaper about Iis and Iu.
     */
    function _checkpoint(address _addr) internal {
        CheckPointParameters memory _st;

        _st.period = period;
        _st.period_time = period_timestamp[_st.period];
        _st.integrate_inv_supply = integrate_inv_supply[_st.period];
        _st.rate = inflation_rate;
        _st.new_rate = _st.rate;
        _st.prev_future_epoch = future_epoch_time;
        if (_st.prev_future_epoch >= _st.period_time) {
            //update future_epoch_time & inflation_rate
            future_epoch_time = insure_token.future_epoch_time_write();
            _st.new_rate = insure_token.rate();
            inflation_rate = _st.new_rate;
        }
        controller.checkpoint_gauge(address(this));

        uint256 _working_balance = working_balances[_addr];
        uint256 _working_supply = working_supply;

        if (is_killed) {
            _st.rate = 0; // Stop distributing inflation as soon as killed
        }

        // Update integral of 1/supply
        if (block.timestamp > _st.period_time) {
            uint256 _prev_week_time = _st.period_time;
            uint256 _week_time;
            unchecked {
                _week_time = min(
                    ((_st.period_time + WEEK) / WEEK) * WEEK,
                    block.timestamp
                );
            }

            for (uint256 i; i < 500;) {
                uint256 _dt = _week_time - _prev_week_time;
                uint256 _w = controller.gauge_relative_weight(
                    address(this),
                    (_prev_week_time / WEEK) * WEEK
                );

                if (_working_supply > 0) {
                    if (
                        _st.prev_future_epoch >= _prev_week_time &&
                        _st.prev_future_epoch < _week_time
                    ) {
                        // If we went across one or multiple epochs, apply the rate
                        // of the first epoch until it ends, and then the rate of
                        // the last epoch.
                        // If more than one epoch is crossed - the gauge gets less,
                        // but that'd meen it wasn't called for more than 1 year
                        _st.integrate_inv_supply +=
                            (_st.rate *
                                _w *
                                (_st.prev_future_epoch - _prev_week_time)) /
                            _working_supply;
                        _st.rate = _st.new_rate;
                        _st.integrate_inv_supply +=
                            (_st.rate *
                                _w *
                                (_week_time - _st.prev_future_epoch)) /
                            _working_supply;
                    } else {
                        _st.integrate_inv_supply +=
                            (_st.rate * _w * _dt) /
                            _working_supply;
                    }
                    // On precisions of the calculation
                    // rate ~= 10e18
                    // last_weight > 0.01 * 1e18 = 1e16 (if pool weight is 1%)
                    // _working_supply ~= TVL * 1e18 ~= 1e26 ($100M for example)
                    // The largest loss is at dt = 1
                    // Loss is 1e-9 - acceptable
                }
                if (_week_time == block.timestamp) {
                    break;
                }
                _prev_week_time = _week_time;
                _week_time = min(_week_time + WEEK, block.timestamp);
                unchecked {
                    ++i;
                }
            }
        }

        _st.period += 1;
        period = _st.period;
        period_timestamp[_st.period] = block.timestamp;
        integrate_inv_supply[_st.period] = _st.integrate_inv_supply;

        // Update user-specific integrals
        // Calc the ΔIu of _addr and add it to Iu.
        integrate_fraction[_addr] +=
            (_working_balance *
                (_st.integrate_inv_supply - integrate_inv_supply_of[_addr])) /
            10 ** 18;
        integrate_inv_supply_of[_addr] = _st.integrate_inv_supply;
        integrate_checkpoint_of[_addr] = block.timestamp;
    }

    /***
     *@notice Record a checkpoint for `_addr`
     *@param _addr User address
     *@return bool success
     */
    function user_checkpoint(address _addr) external returns(bool) {
        require(
            (msg.sender == _addr) || (msg.sender == address(minter)),
            "dev: unauthorized"
        );
        _checkpoint(_addr);
        _update_liquidity_limit(_addr);
        return true;
    }

    /***
     *@notice Get the number of claimable tokens per user
     *@dev This function should be manually changed to "view" in the ABI
     *@return uint256 number of claimable tokens per user
     */
    function claimable_tokens(address _addr) external returns(uint256) {
        _checkpoint(_addr);
        return (integrate_fraction[_addr] -
            minter.minted(_addr, address(this)));
    }

    /***
     *@notice Kick `_addr` for abusing their boost
     *@dev Only if either they had another voting event, or their voting escrow lock expired
     *@param _addr Address to kick
     */
    function kick(address _addr) external {
        uint256 _t_last = integrate_checkpoint_of[_addr];
        uint256 _t_ve = voting_escrow.user_point_history__ts(
            _addr,
            voting_escrow.get_user_point_epoch(_addr)
        );

        require(
            voting_escrow.balanceOf(_addr, block.timestamp) == 0 ||
            _t_ve > _t_last,
            "dev: kick not allowed"
        );

        _checkpoint(_addr);
        _update_liquidity_limit(_addr);
    }

    function integrate_checkpoint() external view returns(uint256) {
        return period_timestamp[period];
    }

    function kill_me() external onlyOwner {
        is_killed = !is_killed;
    }

    function min(uint256 a, uint256 b) internal pure returns(uint256) {
        return a < b ? a : b;
    }
}