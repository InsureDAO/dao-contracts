pragma solidity 0.8.7;

/***
*@title Liquidity Gauge
*@author InsureDAO
* SPDX-License-Identifier: MIT
*@notice Used for measuring liquidity and insurance
*/

//dao-contracts
import "./interfaces/dao/IGaugeController.sol";
import "./interfaces/dao/IInsureToken.sol";
import "./interfaces/dao/IMinter.sol";
import "./interfaces/dao/IVotingEscrow.sol";

//libraries
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";


contract LiquidityGauge is ReentrancyGuard{

    event Deposit(address indexed provider, uint256 value);
    event Withdraw(address indexed provider, uint256 value);
    event UpdateLiquidityLimit(address user, uint256 original_balance, uint256 original_supply, uint256 working_balance, uint256 working_supply, uint256 voting_balance, uint256 voting_total);
    event CommitOwnership(address admin);
    event AcceptOwnership(address admin); 

    uint256 constant TOKENLESS_PRODUCTION = 40;
    uint256 constant BOOST_WARMUP = 86400*14;
    uint256 constant WEEK = 604800;

    //Contracts
    IMinter public minter;
    IInsureToken public insure_token;
    IERC20 public template;
    IGaugeController public controller;
    IVotingEscrow public voting_escrow;


    mapping(address => uint256) public balanceOf;
    uint256 public totalSupply;
    uint256 public future_epoch_time;

    // caller -> recipient -> can deposit?
    mapping(address => mapping(address => bool)) public approved_to_deposit;

    mapping(address => uint256)public working_balances;
    uint256 public working_supply;

    // The goal is to be able to calculate ∫(rate * balance / totalSupply dt) from 0 till checkpoint
    // All values are kept in units of being multiplied by 1e18
    uint256 public period; //modified from "int256 public period" since it never be minus.

    uint256[100000000000000000000000000000] public period_timestamp;

    // 1e18 * ∫(rate(t) / totalSupply(t) dt) from 0 till checkpoint
    uint256[100000000000000000000000000000] public integrate_inv_supply; // bump epoch when rate() changes. Iis(t)=int(r'(t)/S(t))dt (from CurveDAO whitepaper)

    // 1e18 * ∫(rate(t) / totalSupply(t) dt) from (last_action) till checkpoint
    mapping(address => uint256)public integrate_inv_supply_of;
    mapping(address => uint256)public integrate_checkpoint_of;


    // ∫(balance * rate(t) / totalSupply(t) dt) from 0 till checkpoint
    // Units rate * t = already number of coins per address to issue
    mapping(address => uint256)public integrate_fraction; //Mintable Token amount (include minted amount)

    uint256 public inflation_rate;

    address public admin;
    address public future_admin; // Can and will be a smart contract
    bool public is_killed;

    constructor(address lp_addr, address _minter, address _admin){
        /***
        *@notice Contract constructor
        *@param lp_addr Liquidity Pool contract address
        *@param _minter Minter contract address
        *@param _admin Admin who can kill the gauge
        */

        assert (lp_addr != address(0));
        assert (_minter != address(0));

        template = IERC20(lp_addr);
        minter = IMinter(_minter);
        address insure_addr = minter.insure_token();
        insure_token = IInsureToken(insure_addr);
        controller = IGaugeController(minter.gauge_controller());
        voting_escrow = IVotingEscrow(controller.get_voting_escrow());
        period_timestamp[0] = block.timestamp;
        inflation_rate = insure_token.rate();
        future_epoch_time = insure_token.future_epoch_time_write();
        admin = _admin;
    }

    function _update_liquidity_limit(address addr, uint256 l, uint256 L)internal{
        /***
        *@notice Calculate limits which depend on the amount of INSURE Token per-user.
        *        Effectively it calculates working balances to apply amplification
        *        of INSURE production by INSURE
        *@param addr User address
        *@param l User's amount of liquidity (LP tokens)
        *@param L Total amount of liquidity (LP tokens)
        */
        // To be called after totalSupply is updated
        uint256 voting_balance = voting_escrow.balanceOf(addr, block.timestamp);
        uint256 voting_total = voting_escrow.totalSupply(block.timestamp);

        uint256 lim = l * TOKENLESS_PRODUCTION / 100;
        if ((voting_total > 0) && (block.timestamp > period_timestamp[0] + BOOST_WARMUP)){
            lim += L * voting_balance * (100 - TOKENLESS_PRODUCTION) / voting_total / 100;
        }

        lim = min(l, lim);
        uint256 old_bal = working_balances[addr];
        working_balances[addr] = lim;
        uint256 _working_supply = working_supply + lim - old_bal;
        working_supply = _working_supply;

        emit UpdateLiquidityLimit(addr, l, L, lim, _working_supply, voting_balance, voting_total);
    }

    //to avoid "stack too deep"
    struct CheckPointParameters{
        uint256 _period;
        uint256 _period_time;
        uint256 _integrate_inv_supply;
        uint256 rate;
        uint256 new_rate;
        uint256 prev_future_epoch;
        uint256 _working_balance;
        uint256 _working_supply;
    }

    function _checkpoint(address addr)internal{
        /***
        *@notice Checkpoint for a user
        *@param addr User address
        *
        *This function does,
        *1. Calculate Iis for All: Calc and add Iis for every week. Iis only increses over time.
        *2. Calculate Iu for addr: Calc by (defferece between Iis(last time) and Iis(this time))* LP deposit amount of addr(include INSURE locking boost)
        *
        * working_supply & working_balance = total_supply & total_balance with INSURE locking boost。 
        * Check whitepaper about Iis and Iu.
        */
        CheckPointParameters memory st;
        
        st._period = period;
        st._period_time = period_timestamp[st._period];
        st._integrate_inv_supply = integrate_inv_supply[st._period];
        st.rate = inflation_rate;
        st.new_rate = st.rate;
        st.prev_future_epoch = future_epoch_time;
        if (st.prev_future_epoch >= st._period_time){//update future_epoch_time & inflation_rate
            future_epoch_time = insure_token.future_epoch_time_write();
            st.new_rate = insure_token.rate();
            inflation_rate = st.new_rate;
        }
        controller.checkpoint_gauge(address(this));

        uint256 _working_balance = working_balances[addr];
        uint256 _working_supply = working_supply;

        if (is_killed){
            st.rate = 0;  // Stop distributing inflation as soon as killed
        }

        // Update integral of 1/supply
        if (block.timestamp > st._period_time){
            uint256 prev_week_time = st._period_time;
            uint256 week_time = min((st._period_time + WEEK) / WEEK * WEEK, block.timestamp);

            for(uint i; i < 500; i++){
                uint256 dt = week_time - prev_week_time;
                uint256 w = controller.gauge_relative_weight(address(this), prev_week_time / WEEK * WEEK);

                if (_working_supply > 0){
                    if (st.prev_future_epoch >= prev_week_time && st.prev_future_epoch < week_time){
                        // If we went across one or multiple epochs, apply the rate
                        // of the first epoch until it ends, and then the rate of
                        // the last epoch.
                        // If more than one epoch is crossed - the gauge gets less,
                        // but that'd meen it wasn't called for more than 1 year
                        st._integrate_inv_supply += st.rate * w * (st.prev_future_epoch - prev_week_time) / _working_supply;
                        st.rate = st.new_rate;
                        st._integrate_inv_supply += st.rate * w * (week_time - st.prev_future_epoch) / _working_supply;
                    }else{
                        st._integrate_inv_supply += st.rate * w * dt / _working_supply;
                    }
                    // On precisions of the calculation
                    // rate ~= 10e18
                    // last_weight > 0.01 * 1e18 = 1e16 (if pool weight is 1%)
                    // _working_supply ~= TVL * 1e18 ~= 1e26 ($100M for example)
                    // The largest loss is at dt = 1
                    // Loss is 1e-9 - acceptable
                }
                if (week_time == block.timestamp){
                    break;
                }
                prev_week_time = week_time;
                week_time = min(week_time + WEEK, block.timestamp);
            }
        }

        st._period += 1;
        period = st._period;
        period_timestamp[st._period] = block.timestamp;
        integrate_inv_supply[st._period] = st._integrate_inv_supply;

        // Update user-specific integrals
        // Calc the ΔIu of addr and add it to Iu.
        integrate_fraction[addr] += _working_balance * (st._integrate_inv_supply - integrate_inv_supply_of[addr]) / 10 ** 18;
        integrate_inv_supply_of[addr] = st._integrate_inv_supply;
        integrate_checkpoint_of[addr] = block.timestamp;
    }

    function user_checkpoint(address addr)external returns (bool){
        /***
        *@notice Record a checkpoint for `addr`
        *@param addr User address
        *@return bool success
        */
        require ((msg.sender == addr) || (msg.sender == address(minter)), "dev: unauthorized");
        _checkpoint(addr);
        _update_liquidity_limit(addr, balanceOf[addr], totalSupply);
        return true;
    }

    function claimable_tokens(address addr)external returns (uint256){
        /***
        *@notice Get the number of claimable tokens per user
        *@dev This function should be manually changed to "view" in the ABI
        *@return uint256 number of claimable tokens per user
        */
        _checkpoint(addr);
        return (integrate_fraction[addr] - minter.minted(addr, address(this)));
    }


    function kick(address addr)external{
        /***
        *@notice Kick `addr` for abusing their boost
        *@dev Only if either they had another voting event, or their voting escrow lock expired
        *@param addr Address to kick
        */
        uint256 t_last = integrate_checkpoint_of[addr];
        uint256 t_ve = voting_escrow.user_point_history__ts(
            addr, voting_escrow.get_user_point_epoch(addr)
        );
        uint256 _balance = balanceOf[addr];

        require(voting_escrow.balanceOf(addr, block.timestamp) == 0 || t_ve > t_last, "dev: kick not allowed");
        require(working_balances[addr] > _balance * TOKENLESS_PRODUCTION / 100, "dev: kick not needed");

        _checkpoint(addr);
        _update_liquidity_limit(addr, balanceOf[addr], totalSupply);
    }

    function set_approve_deposit(address addr, bool can_deposit)external{
        /***
        *@notice Set whether `addr` can deposit tokens for `msg.sender`
        *@param addr Address to set approval on
        *@param can_deposit bool - can this account deposit for `msg.sender`?
        */
        approved_to_deposit[addr][msg.sender] = can_deposit;
    }

    function deposit(uint256 _value, address addr)external nonReentrant{
        /***
        *@notice Deposit `_value` LP tokens
        *@param _value Number of tokens to deposit
        *@param addr Address to deposit for
        */
        if (addr != msg.sender){
            require(approved_to_deposit[msg.sender][addr], "Not approved");
        }

        _checkpoint(addr);

        if (_value != 0){
            uint256 _balance = balanceOf[addr] + _value;
            uint256 _supply = totalSupply + _value;
            balanceOf[addr] = _balance;
            totalSupply = _supply;

            _update_liquidity_limit(addr, _balance, _supply);

            assert(template.transferFrom(msg.sender, address(this), _value));
        }
        emit Deposit(addr, _value);
    }

    function withdraw(uint256 _value)external nonReentrant{
        /***
        *@notice Withdraw `_value` LP tokens
        *@param _value Number of tokens to withdraw
        */
        _checkpoint(msg.sender);

        uint256 _balance = balanceOf[msg.sender] - _value;
        uint256 _supply = totalSupply - _value;
        balanceOf[msg.sender] = _balance;
        totalSupply = _supply;

        _update_liquidity_limit(msg.sender, _balance, _supply);

        require(template.transfer(msg.sender, _value));

        emit Withdraw(msg.sender, _value);
    }

    function integrate_checkpoint()external view returns (uint256){
        return period_timestamp[period];
    }

    function kill_me()external{
        assert (msg.sender == admin);
        is_killed = !is_killed;
    }


    function commit_transfer_ownership(address addr)external{
        /***
        *@notice Transfer ownership of GaugeController to `addr`
        *@param addr Address to have ownership transferred to
        */
        require (msg.sender == admin, "dev: admin only");
        future_admin = addr;
        emit CommitOwnership(addr);
    }

    function accept_transfer_ownership()external {
        /***
        *@notice Accept a transfer of ownership
        *@return bool success
        */
        require(address(msg.sender) == future_admin, "dev: future_admin only");

        admin = future_admin;

        emit AcceptOwnership(admin);
    }

    function min(uint256 a, uint256 b) internal pure returns (uint256) {
        return a < b ? a : b;
    }
}