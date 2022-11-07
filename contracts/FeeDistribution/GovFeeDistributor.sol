// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.10;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {SafeCast} from "@openzeppelin/contracts/utils/math/SafeCast.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/security/ReentrancyGuard.sol";

import {IVotingEscrow} from "../interfaces/dao/IVotingEscrow.sol";
import {VotingEscrow} from "../VotingEscrow.sol";

import "../interfaces/pool/IVault.sol";
import "../interfaces/pool/ICDSTemplate.sol";
import "../interfaces/pool/IOwnership.sol";

import {ITokenCheckpointLogic} from "../libraries/ITokenCheckpointLogic.sol";
import {VeCheckpointLogic} from "../libraries/VeCheckpointLogic.sol";

import {OnlyOwner, AddressZero, AmountZero, ContractUnavailable, InsufficientBalance} from "../errors/CommonErrors.sol";

contract GovFeeDistributor is ReentrancyGuard {
    using SafeERC20 for IERC20;
    using SafeCast for int256;
    using SafeCast for uint256;

    uint256 constant WEEK = 7 * 86_400;
    uint256 constant TOKEN_CHECKPOINT_INTERVAL = 86_400;

    uint256 public immutable distributionStart;

    /// @notice dao contracts
    address public votingEscrow;

    /// @notice pool contracts
    address public vault;
    address public ownership;
    address public depositToken;

    /// @notice iToken address
    address public iToken;

    mapping(address => uint256) public userTimeCursors;

    mapping(address => uint256) public userEpochs;

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

    function depositBalanceToReserve() external nonReentrant notKilled {
        _depositBalanceToReserve(IERC20(depositToken).balanceOf(address(this)));
    }

    function depositBalanceToReserve(uint256 _amount)
        external
        nonReentrant
        notKilled
    {
        _depositBalanceToReserve(_amount);
    }

    function claim()
        external
        nonReentrant
        notKilled
        claimPreparation
        returns (uint256)
    {
        return _claim(msg.sender);
    }

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

    function veSupplyCheckpoint() external {
        VeCheckpointLogic.checkpoint(votingEscrow, veCheckpointRecord);
    }

    function iTokenCheckPoint() external {
        ITokenCheckpointLogic.checkpoint(
            iToken,
            address(this),
            iTokenCheckpointRecord
        );
    }

    function burn() external nonReentrant notKilled returns (bool) {
        uint256 _amount = IERC20(iToken).balanceOf(msg.sender);

        if (_amount == 0) return false;

        IERC20(iToken).safeTransferFrom(msg.sender, address(this), _amount);
        if (
            block.timestamp >
            iTokenCheckpointRecord.lastITokenTime + TOKEN_CHECKPOINT_INTERVAL
        )
            ITokenCheckpointLogic.checkpoint(
                iToken,
                address(this),
                iTokenCheckpointRecord
            );

        emit Burnt(msg.sender, _amount);

        return true;
    }

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

    function iTokenSupplyAt(uint256 _weekCursor)
        external
        view
        returns (uint256)
    {
        return iTokenCheckpointRecord.iTokenSupplyPerWeek[_weekCursor];
    }

    function veSupplyAt(uint256 _weekCursor) external view returns (uint256) {
        return veCheckpointRecord.veSupplyPerWeek[_weekCursor];
    }

    function lastITokenBalance() external view returns (uint256) {
        return iTokenCheckpointRecord.lastITokenBalance;
    }

    function lastITokenTime() external view returns (uint256) {
        return iTokenCheckpointRecord.lastITokenTime;
    }

    /**
     * internal functions
     */

    function _depositBalanceToReserve(uint256 _amount) internal {
        uint256 _balance = IERC20(depositToken).balanceOf(address(this));
        if (_amount == 0) revert AmountZero();
        if (_balance < _amount) revert InsufficientBalance();

        uint256 _allowanceShortage = _amount -
            IERC20(depositToken).allowance(address(this), vault);

        if (_allowanceShortage > 0)
            IERC20(depositToken).safeIncreaseAllowance(
                vault,
                _allowanceShortage
            );

        uint256 _beforeDeposit = IERC20(iToken).balanceOf(address(this));
        uint256 _minted = ICDSTemplate(iToken).deposit(_amount);

        assert(
            IERC20(iToken).balanceOf(address(this)) == _beforeDeposit + _minted
        );

        emit ITokenReceived(_minted);
    }

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
                    uint256 _iTokenSupply = iTokenCheckpointRecord
                        .iTokenSupplyPerWeek[_weekCursor];
                    uint256 _veTotalSupply = veCheckpointRecord.veSupplyPerWeek[
                        _weekCursor
                    ];
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

    function _findGlobalEpoch(uint256 _targetTs)
        internal
        view
        returns (uint256)
    {
        uint256 _max = VotingEscrow(votingEscrow).epoch();
        uint256 _min = 0;

        for (uint256 i = 0; i < 128; i++) {
            if (_min >= _max) break;
            uint256 _mid = (_min + _max + 2) / 2;

            (, , uint256 _ts, ) = VotingEscrow(votingEscrow).point_history(
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

            (, , uint256 _ts, ) = VotingEscrow(votingEscrow).user_point_history(
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

    // private functions
    function _getCurrentUserEpoch(address _user, uint256 _maxUserEpoch)
        private
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

    function _getUserPoint(address _user, uint256 _userEpoch)
        private
        view
        returns (VotingEscrow.Point memory)
    {
        (int256 _bias, int256 _slope, uint256 _ts, uint256 _blk) = VotingEscrow(
            votingEscrow
        ).user_point_history(_user, _userEpoch);

        return VotingEscrow.Point(_bias, _slope, _ts, _blk);
    }

    function _getUserWeekCursor(address _user, uint256 _userPointTs)
        private
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
}
