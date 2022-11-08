pragma solidity 0.8.10;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {SafeCast} from "@openzeppelin/contracts/utils/math/SafeCast.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/security/ReentrancyGuard.sol";

import {ITokenCheckpointLogic} from "../libraries/ITokenCheckpointLogic.sol";
import {VeCheckpointLogic} from "../libraries/VeCheckpointLogic.sol";

import {VotingEscrow} from "../VotingEscrow.sol";

import {ICDSTemplate} from "../interfaces/pool/ICDSTemplate.sol";
import {IOwnership} from "../interfaces/pool/IOwnership.sol";

import {OnlyOwner, AddressZero, AmountZero, ContractUnavailable, InsufficientBalance} from "../errors/CommonErrors.sol";

/**
 * SPDX-License-Identifier: GPL-3.0-or-later
 * @title InsureDAO governance fee distributor
 * @author InsureDAO
 * @notice This distributes governance fee, which is occured each insurance and saved in the vault,
 *         to veINSURE holders.
 */

contract GovFeeDistributor is ReentrancyGuard {
    using SafeERC20 for IERC20;
    using SafeCast for int256;
    using SafeCast for uint256;

    uint256 constant WEEK = 7 * 86_400;
    /// @dev the minimum interval for next iToken checkpoint
    uint256 constant TOKEN_CHECKPOINT_INTERVAL = 86_400;

    /// @notice dao contract
    address public votingEscrow;

    /// @notice pool contracts
    address public vault;
    address public ownership;
    address public depositToken;

    /// @notice iToken address
    address public iToken;

    /// @notice distribution start time(rounded by WEEK)
    uint256 public immutable distributionStart;
    /// @notice week boundaries where each user currently is
    mapping(address => uint256) public userTimeCursors;
    /// @notice the last veINSURE epochs each user receives their govanance fee reward
    mapping(address => uint256) public userEpochs;

    /// @notice if this true, the contract will be permanently unavailable
    bool public isKilled;

    /// @notice see VeCheckpointLogic.sol
    VeCheckpointLogic.VeCheckpoint public veCheckpointRecord;
    /// @notice see ITokenCheckpointLogic.sol
    ITokenCheckpointLogic.ITokenCheckpoint public iTokenCheckpointRecord;

    modifier onlyOwner() {
        if (msg.sender != IOwnership(ownership).owner()) revert OnlyOwner();
        _;
    }

    modifier notKilled() {
        if (isKilled) revert ContractUnavailable();
        _;
    }

    /**
     * @notice checkpoints total veINSURE and iToken supply
     *         before user claiming their iToken reward.
     */
    modifier claimPreparation() {
        // check if veINSURE to be checkpointed
        if (block.timestamp > veCheckpointRecord.latestTimeCursor)
            VeCheckpointLogic.checkpoint(votingEscrow, veCheckpointRecord);
        // check if fee token to be checkpointed
        if (
            block.timestamp >
            iTokenCheckpointRecord.lastITokenTime + TOKEN_CHECKPOINT_INTERVAL
        )
            ITokenCheckpointLogic.checkpoint(
                iToken,
                address(this),
                iTokenCheckpointRecord
            );
        _;
    }

    event ITokenReceived(uint256 _amount);
    event Claimed(address _to, uint256 _amount);
    event ITokenCheckpointed(uint256 _checkpointTime);
    event VeCheckpointed(uint256 _lastCheckpointTime);
    event Burnt(address _from, uint256 _amount);
    event Killed(uint256 _time);

    constructor(
        address _vault,
        address _votingEscrow,
        address _ownership,
        address _iToken,
        address _depositToken,
        uint256 _startTime
    ) {
        if (
            _vault == address(0) ||
            _votingEscrow == address(0) ||
            _ownership == address(0) ||
            _iToken == address(0) ||
            _depositToken == address(0)
        ) revert AddressZero();

        uint256 _distributionStart = (_startTime / WEEK) * WEEK;

        vault = _vault;
        votingEscrow = _votingEscrow;
        ownership = _ownership;
        iToken = _iToken;
        depositToken = _depositToken;
        distributionStart = _distributionStart;

        veCheckpointRecord.latestTimeCursor = _distributionStart;
        iTokenCheckpointRecord.lastITokenTime = _distributionStart;
    }

    /**
     * external functions
     */

    /**
     * @notice deposits all govanance fee this contract has,
     *         then receives iToken(Reserve pool's LP token).
     */
    function depositBalanceToReserve() external nonReentrant notKilled {
        _depositBalanceToReserve(IERC20(depositToken).balanceOf(address(this)));
    }

    /**
     * @notice overload function to specify the amount for LP token conversion.
     * @param _amount the amount deposited into reserve pool
     */
    function depositBalanceToReserve(uint256 _amount)
        external
        nonReentrant
        notKilled
    {
        _depositBalanceToReserve(_amount);
    }

    /**
     * @notice claim all eligible amount of iToken to msg sender.
     *         this should be called by a veINSURE holder.
     * @return claimed iToken amount
     */
    function claim()
        external
        nonReentrant
        notKilled
        claimPreparation
        returns (uint256)
    {
        return _claim(msg.sender);
    }

    /**
     * @notice claim all eligible amount of iToken on behalf of holder.
     *         anyone can call this function.
     * @param _to veINSURE holder address all claimed reward send
     * @return claimed iToken amount
     */
    function claim(address _to)
        external
        nonReentrant
        notKilled
        claimPreparation
        returns (uint256)
    {
        if (_to == address(0)) revert AddressZero();
        return _claim(_to);
    }

    /**
     * @notice execute claim for multiple addresses, this used for multi user distribution,
     *         or claim for same user who has large veINSURE hisrory.
     * @param _receivers the addresses of veINSURE holders.
     * @dev you can include same addresses as params for large veINSURE history.
     * @dev addresses should be left aligned, otherwise claim will be cancelled in the middle of process.
     * @return claim success
     */
    function claimMany(address[20] calldata _receivers)
        external
        nonReentrant
        notKilled
        claimPreparation
        returns (bool)
    {
        uint256 _total = 0;

        for (uint256 i = 0; i < 20; i++) {
            address _receiver = _receivers[i];
            // no receiver specified, then end the loop immidiately
            if (_receiver == address(0)) break;

            uint256 _amount = _claim(_receiver);
            _total += _amount;
        }

        return true;
    }

    /**
     * @notice checkpoints veINSURE total supply each week.
     *         see VeCheckpointLogic.sol for more details.
     */
    function veSupplyCheckpoint() external {
        VeCheckpointLogic.checkpoint(votingEscrow, veCheckpointRecord);
    }

    /**
     * @notice checkpoints iToken(Reseve pool LP token) total supply each week.
     *         see ITokenCheckpointLogic.sol for more details.
     */
    function iTokenCheckPoint() external {
        ITokenCheckpointLogic.checkpoint(
            iToken,
            address(this),
            iTokenCheckpointRecord
        );
    }

    /**
     * @notice burn all iToken of msg.sender.
     * @dev technically, token does not go to address(0) but goes to this contract.
     *      so burning increases this contract balance and distributed to holders again.
     * @return burn success
     */
    function burn() external nonReentrant notKilled returns (bool) {
        uint256 _amount = IERC20(iToken).balanceOf(msg.sender);

        if (_amount == 0) return false;

        IERC20(iToken).safeTransferFrom(msg.sender, address(this), _amount);

        // needs to wait for interval to checkpoint
        bool _checkpointable = block.timestamp >
            iTokenCheckpointRecord.lastITokenTime + TOKEN_CHECKPOINT_INTERVAL;

        if (_checkpointable)
            ITokenCheckpointLogic.checkpoint(
                iToken,
                address(this),
                iTokenCheckpointRecord
            );

        emit Burnt(msg.sender, _amount);

        return true;
    }

    /**
     * @notice deactivate the distributor contract. once killed,
     *         the contract permanently unavailable.
     */
    function killMe(address _to) external nonReentrant onlyOwner {
        isKilled = true;

        uint256 _iTokenBalance = IERC20(iToken).balanceOf(address(this));
        uint256 _depositTokenBalance = IERC20(depositToken).balanceOf(
            address(this)
        );
        IERC20(iToken).safeTransfer(_to, _iTokenBalance);
        IERC20(depositToken).safeTransfer(_to, _depositTokenBalance);

        emit Killed(block.timestamp);
    }

    /**
     * @notice get last checkpointed iToken balance.
     * @return last checkpointed iToken balance.
     */
    function lastITokenBalance() external view returns (uint256) {
        return iTokenCheckpointRecord.lastITokenBalance;
    }

    /**
     * @notice get last iToken checkpointed time.
     * @return last iToken checkpointed time.
     */
    function lastITokenTime() external view returns (uint256) {
        return iTokenCheckpointRecord.lastITokenTime;
    }

    /**
     * public functions
     */
    /**
     * @notice get total iToken distribution of a week.
     * @param _weekCursor week boundary distribution activated
     * @dev week cursor must be rounded for the start of a week.
     * @return total iToken distribution of a week.
     */
    function iTokenSupplyAt(uint256 _weekCursor) public view returns (uint256) {
        return iTokenCheckpointRecord.iTokenSupplyPerWeek[_weekCursor];
    }

    /**
     * @notice get total veINSURE supply of a week.
     * @param _weekCursor week boundary iToken distribution activated
     * @dev week cursor must be rounded for the start of a week.
     * @return total veINSURE supply of a week.
     */
    function veSupplyAt(uint256 _weekCursor) public view returns (uint256) {
        return veCheckpointRecord.veSupplyPerWeek[_weekCursor];
    }

    /**
     * internal functions
     */

    function _depositBalanceToReserve(uint256 _amount) internal {
        uint256 _balance = IERC20(depositToken).balanceOf(address(this));
        if (_amount == 0) revert AmountZero();
        // needs enough amount to deposit
        if (_balance < _amount) revert InsufficientBalance();

        // allowance increased on demand
        uint256 _allowanceShortage = _amount -
            IERC20(depositToken).allowance(address(this), vault);

        if (_allowanceShortage > 0)
            IERC20(depositToken).safeIncreaseAllowance(
                vault,
                _allowanceShortage
            );

        uint256 _beforeDeposit = IERC20(iToken).balanceOf(address(this));
        uint256 _minted = ICDSTemplate(iToken).deposit(_amount);

        // check balance correctly increased
        assert(
            IERC20(iToken).balanceOf(address(this)) == _beforeDeposit + _minted
        );

        emit ITokenReceived(_minted);
    }

    /**
     * @dev claim proceeds in following steps:
     *      1. get(or initialize) user's current veINSURE and iToken distribution state
     *      2. calculate distribution amount(iterate distribution cursor and user point)
     *      3. update user's state to latest
     *      4. execute distribution(if any distribution is)
     */
    function _claim(address _to) internal returns (uint256) {
        // current veINSURE checkpoint the user is at
        uint256 _maxUserEpoch = VotingEscrow(votingEscrow).user_point_epoch(
            _to
        );
        // latest week boundary distribution completed
        uint256 _latestITokenSupplyTime = (iTokenCheckpointRecord
            .lastITokenTime / WEEK) * WEEK;

        // no lock exist
        if (_maxUserEpoch == 0) return 0;

        // if this claim is the first time, initialize epoch
        uint256 _userEpoch = _getCurrentUserEpoch(_to, _maxUserEpoch);

        // anchored to next user point
        VotingEscrow.Point memory _nextUserPoint = _getUserPoint(
            _to,
            _userEpoch
        );
        // actually calculated by this point. start from zero
        VotingEscrow.Point memory _userPoint = VotingEscrow.Point(0, 0, 0, 0);

        uint256 _weekCursor = _getUserWeekCursor(_to, _nextUserPoint.ts);

        // no reward claimable
        if (_weekCursor >= _latestITokenSupplyTime) return 0;

        uint256 _distribution = 0;

        for (uint256 i = 0; i < 50; i++) {
            // distribution should be executed until last iToken checkpoint
            if (_weekCursor > _latestITokenSupplyTime) break;

            // user ve point before than current distribution point, then move epoch and point forward
            if (
                _weekCursor >= _nextUserPoint.ts && _userEpoch <= _maxUserEpoch
            ) {
                _userEpoch++;
                _userPoint = _nextUserPoint;

                // in this case, no userchecpoint found anymore, so keep it zero
                if (_userEpoch > _maxUserEpoch)
                    _nextUserPoint = VotingEscrow.Point(0, 0, 0, 0);
                    // otherwise, keep updating user point
                else _nextUserPoint = _getUserPoint(_to, _userEpoch);
            }
            // otherwise, add iToken distribution
            else {
                // calculate veINSURE balance from user point
                int256 _dt = (_weekCursor - _userPoint.ts).toInt256();
                int256 _val = _userPoint.bias - _dt * _userPoint.slope;
                uint256 _userVeBalance = _val > 0 ? _val.toUint256() : 0;

                // even if passed user's max epoch, continue until veINSURE worth zero
                if (_userVeBalance == 0 && _userEpoch > _maxUserEpoch) break;

                // distribution determined by the share of user veINSURE balance
                if (_userVeBalance > 0) {
                    uint256 _iTokenSupply = iTokenSupplyAt(_weekCursor);
                    uint256 _veTotalSupply = veSupplyAt(_weekCursor);

                    _distribution +=
                        (_userVeBalance * _iTokenSupply) /
                        _veTotalSupply;
                }
                _weekCursor += WEEK;
            }
        }

        // update user current state
        _userEpoch = Math.min(_maxUserEpoch, _userEpoch - 1);
        userEpochs[_to] = _userEpoch;
        userTimeCursors[_to] = _weekCursor;

        // finally, if distribution exists, transfer it to the user
        if (_distribution != 0) {
            IERC20(iToken).safeTransfer(_to, _distribution);
            unchecked {
                iTokenCheckpointRecord.lastITokenBalance -= _distribution;
            }
            emit Claimed(_to, _distribution);
        }

        return _distribution;
    }

    /**
     * @dev if user epoch saved in storage, return it.
     *      otherwise, do binary search to find nearest epoch
     */
    function _getCurrentUserEpoch(address _user, uint256 _maxUserEpoch)
        internal
        view
        returns (uint256)
    {
        uint256 _weekCursor = userTimeCursors[_user];
        if (_weekCursor == 0) {
            uint256 _userEpoch = _findUserEpoch(
                _user,
                distributionStart,
                _maxUserEpoch
            );
            return _userEpoch != 0 ? _userEpoch : 1;
        }

        return userEpochs[_user];
    }

    /**
     * @dev get user point by epoch, reconstruct it to struct
     */
    function _getUserPoint(address _user, uint256 _userEpoch)
        internal
        view
        returns (VotingEscrow.Point memory)
    {
        (int256 _bias, int256 _slope, uint256 _ts, uint256 _blk) = VotingEscrow(
            votingEscrow
        ).user_point_history(_user, _userEpoch);

        return VotingEscrow.Point(_bias, _slope, _ts, _blk);
    }

    /**
     * @dev if user cursor saved in storage, return it.
     *      otherwise, initialize cursor.
     */
    function _getUserWeekCursor(address _user, uint256 _userPointTs)
        internal
        view
        returns (uint256)
    {
        uint256 _weekCursor = userTimeCursors[_user];

        if (_weekCursor != 0) return _weekCursor;

        // if first time, distribution will be active from next week boundary
        uint256 _roundedUserPointTs = ((_userPointTs + WEEK - 1) / WEEK) * WEEK;

        // if the rounded cursor before than distribution start, skip for it
        if (_roundedUserPointTs < distributionStart) return distributionStart;

        return _roundedUserPointTs;
    }

    /**
     * @dev find nearest user epoch less than given ts
     * @param _user user address
     * @param _targetTs timestamp to find user epoch
     * @param _maxUserEpoch upper limit for the exploration
     */
    function _findUserEpoch(
        address _user,
        uint256 _targetTs,
        uint256 _maxUserEpoch
    ) internal view returns (uint256) {
        uint256 _min = 0;
        uint256 _max = _maxUserEpoch;

        for (uint256 i = 0; i < 20; i++) {
            if (_min >= _max) break;

            uint256 _mid = (_min + _max + 2) / 2;

            uint256 _ts = VotingEscrow(votingEscrow).user_point_history__ts(
                _user,
                _mid
            );

            if (_ts > _targetTs) {
                unchecked {
                    _max = _mid - 1;
                }
            } else {
                unchecked {
                    _min = _mid;
                }
            }
        }

        return _min;
    }
}
