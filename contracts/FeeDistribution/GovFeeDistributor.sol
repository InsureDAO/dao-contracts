// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.10;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {SafeCast} from "@openzeppelin/contracts/utils/math/SafeCast.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

import {IVotingEscrow} from "../interfaces/dao/IVotingEscrow.sol";
import {VotingEscrow} from "../VotingEscrow.sol";

import "../interfaces/pool/IVault.sol";
import "../interfaces/pool/ICDSTemplate.sol";
import "../interfaces/pool/IOwnership.sol";

import "hardhat/console.sol";

contract GovFeeDistributor {
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

    /// @dev veToken total supply of each week boundary
    uint256[1e15] public veSupply;

    uint256[1e15] public iTokenSupply;

    /// @dev last global checkpointed time
    uint256 public timeCursor;
    mapping(address => uint256) public userTimeCursors;

    uint256 public lastITokenTime;
    uint256 public lastITokenBalance;

    mapping(address => uint256) public userEpochs;

    bool public isKilled;

    modifier onlyOwner() {
        if (msg.sender != IOwnership(ownership).owner()) revert OnlyOwner();
        _;
    }

    modifier notKilled() {
        if (isKilled) revert Killed();
        _;
    }

    modifier claimPreparation() {
        // check if veINSURE to be checkpointed
        if (block.timestamp > timeCursor) _veSupplyCheckpoint();
        // check if fee token to be checkpointed
        if (block.timestamp > lastITokenTime + TOKEN_CHECKPOINT_INTERVAL)
            _iTokenCheckPoint();
        _;
    }

    event ITokenIncreased(uint256 _amount);
    event Claimed(address _to, uint256 _amount);

    constructor(
        address _vault,
        address _votingEscrow,
        address _ownership,
        address _iToken,
        address _depositToken,
        uint256 _startTime
    ) {
        // actual start time is rounded to the nearest week start time
        uint256 _distributionStart = (_startTime / WEEK) * WEEK;

        vault = _vault;
        votingEscrow = _votingEscrow;
        ownership = _ownership;
        iToken = _iToken;
        depositToken = _depositToken;
        distributionStart = _distributionStart;
        lastITokenTime = _distributionStart;
        timeCursor = _distributionStart;
    }

    function depositBalanceToReserve() external {
        _depositBalanceToReserve(IERC20(depositToken).balanceOf(address(this)));
    }

    function depositBalanceToReserve(uint256 _amount) external {
        _depositBalanceToReserve(_amount);
    }

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
    }

    function claim() external notKilled claimPreparation returns (uint256) {
        return _claim(msg.sender);
    }

    function claim(address _to)
        external
        notKilled
        claimPreparation
        returns (uint256)
    {
        return _claim(_to);
    }

    function claimMany(address[20] calldata _receivers)
        external
        notKilled
        claimPreparation
        returns (bool)
    {
        uint256 _total = 0;

        for (uint256 i = 0; i < 20; i++) {
            address _receiver = _receivers[i];
            if (_receiver == address(0)) revert AddressZero();

            uint256 _amount = _claim(_receiver);
            _total += _amount;
        }

        if (_total != 0) lastITokenBalance -= _total;

        return true;
    }

    function burn() external notKilled returns (bool) {
        uint256 _amount = IERC20(iToken).balanceOf(msg.sender);
        if (_amount != 0) {
            IERC20(iToken).safeTransferFrom(msg.sender, address(this), _amount);
            if (block.timestamp > lastITokenTime + TOKEN_CHECKPOINT_INTERVAL)
                _iTokenCheckPoint();
        }
        return true;
    }

    function killMe(address _to) external onlyOwner {
        isKilled = true;
        uint256 _balance = IERC20(iToken).balanceOf(address(this));
        IERC20(iToken).safeTransfer(_to, _balance);
    }

    function _claim(address _to) internal returns (uint256) {
        uint256 _maxUserEpoch = VotingEscrow(votingEscrow).user_point_epoch(
            _to
        );
        uint256 _roundedITokenTime = (lastITokenTime / WEEK) * WEEK;

        // no lock exist
        if (_maxUserEpoch == 0) return 0;

        uint256 _weekCursor = userTimeCursors[_to];
        // if this claim is the first time, initialize epoch
        uint256 _userEpoch = _weekCursor == 0
            ? _findUserEpoch(_to, distributionStart, _maxUserEpoch)
            : userEpochs[_to];

        if (_userEpoch == 0) _userEpoch = 1;

        (int256 _bias, int256 _slope, uint256 _ts, uint256 _blk) = VotingEscrow(
            votingEscrow
        ).user_point_history(_to, _userEpoch);

        // distribution will be active from next week boundary
        if (_weekCursor == 0) _weekCursor = ((_ts + WEEK - 1) / WEEK) * WEEK;

        // no reward claimable
        if (_weekCursor >= _roundedITokenTime) return 0;

        // skip for the start of distribution
        if (_weekCursor < distributionStart) _weekCursor = distributionStart;

        VotingEscrow.Point memory _userPoint = VotingEscrow.Point(
            _bias,
            _slope,
            _ts,
            _blk
        );
        VotingEscrow.Point memory _oldUserPoint = VotingEscrow.Point(
            0,
            0,
            0,
            0
        );

        uint256 _distribution = 0;

        for (uint256 i = 0; i < 50; i++) {
            if (_weekCursor > _roundedITokenTime) break;

            if (_weekCursor >= _userPoint.ts && _userEpoch <= _maxUserEpoch) {
                _userEpoch++;
                _oldUserPoint = _userPoint;

                if (_userEpoch > _maxUserEpoch) {
                    _userPoint = VotingEscrow.Point(0, 0, 0, 0);
                } else {
                    (_bias, _slope, _ts, _blk) = VotingEscrow(votingEscrow)
                        .user_point_history(_to, _userEpoch);

                    _userPoint = VotingEscrow.Point(_bias, _slope, _ts, _blk);
                }
            } else {
                int256 _dt = (_weekCursor - _oldUserPoint.ts).toInt256();
                int256 _val = _oldUserPoint.bias - _dt * _oldUserPoint.slope;
                uint256 _balance = _val > 0 ? _val.toUint256() : 0;

                if (_balance == 0 && _userEpoch > _maxUserEpoch) break;

                if (_balance > 0)
                    _distribution +=
                        (_balance * iTokenSupply[_weekCursor]) /
                        veSupply[_weekCursor];
                _weekCursor += WEEK;
            }
        }

        _userEpoch = Math.min(_maxUserEpoch, _userEpoch - 1);
        userEpochs[_to] = _userEpoch;
        userTimeCursors[_to] = _weekCursor;

        if (_distribution != 0) {
            IERC20(iToken).safeTransfer(_to, _distribution);
            unchecked {
                lastITokenBalance -= _distribution;
            }
        }

        emit Claimed(_to, _distribution);

        return _distribution;
    }

    function _veSupplyCheckpoint() internal {
        // round by week
        uint256 _weekStartTs = (block.timestamp / WEEK) * WEEK;
        VotingEscrow(votingEscrow).checkpoint();

        uint256 _timeCursor = timeCursor;

        // record veINSURE supply each week
        for (uint256 i = 0; i < 20; i++) {
            if (_timeCursor > _weekStartTs) break;

            uint256 _epoch = _findGlobalEpoch(_timeCursor);
            (int256 _bias, int256 _slope, uint256 _ts, ) = VotingEscrow(
                votingEscrow
            ).point_history(_epoch);

            int256 _dt = _timeCursor > _ts
                ? int256(_timeCursor - _ts)
                : int256(0);

            int256 _supply = _bias - _dt * _slope;

            veSupply[_timeCursor] = uint256(_supply);

            unchecked {
                _timeCursor += WEEK;
            }
        }

        timeCursor = _timeCursor;
    }

    function veSupplyCheckpoint() external {
        _veSupplyCheckpoint();
    }

    function _iTokenCheckPoint() internal {
        uint256 _iTokenBalance = IERC20(iToken).balanceOf(address(this));
        uint256 _distribution = _iTokenBalance - lastITokenBalance;

        uint256 _start = lastITokenTime;
        uint256 _entireDuration = block.timestamp - _start;

        uint256 _currentWeek = (_start / WEEK) * WEEK;
        uint256 _nextWeek;

        lastITokenBalance = _iTokenBalance;
        lastITokenTime = block.timestamp;

        for (uint256 i = 0; i < 20; i++) {
            _nextWeek = _currentWeek + WEEK;

            // reached latest week, loop end
            if (block.timestamp < _nextWeek) {
                // no duration but balance increased
                if (_entireDuration == 0 && block.timestamp == _start) {
                    iTokenSupply[_currentWeek] = _distribution;
                }
                // decide the portion of distribution
                else {
                    uint256 _currentDuration = (block.timestamp - _start);
                    iTokenSupply[_currentWeek] =
                        (_distribution * _currentDuration) /
                        _entireDuration;
                }
                break;
            }
            // unrecorded weeks remaining, loop continue
            else {
                if (_entireDuration == 0 && _nextWeek == _start) {
                    iTokenSupply[_currentWeek] += _distribution;
                } else {
                    uint256 _currentDuration = (_nextWeek - _start);
                    iTokenSupply[_currentWeek] +=
                        (_distribution * _currentDuration) /
                        _entireDuration;
                }
            }

            _start = _nextWeek;
            _currentWeek = _nextWeek;
        }
    }

    function iTokenCheckPoint() external {
        _iTokenCheckPoint();
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
}

error OnlyOwner();
error AddressZero();
error AmountZero();
error Killed();
error InsufficientBalance();
