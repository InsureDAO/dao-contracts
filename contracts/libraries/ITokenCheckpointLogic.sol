// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.10;

import "@openzeppelin/contracts/interfaces/IERC20.sol";

uint256 constant WEEK = 7 * 86_400;

library ITokenCheckpointLogic {
    struct ITokenCheckpoint {
        uint256 lastITokenTime;
        uint256 lastITokenBalance;
        uint256[1e15] iTokenSupplyPerWeek;
    }

    event ITokenCheckpointed(uint256 _checkpointTime);

    function checkpoint(
        address _iToken,
        address _distributor,
        ITokenCheckpoint storage record
    ) internal {
        uint256 _currentBalance = IERC20(_iToken).balanceOf(_distributor);
        uint256 _distribution = _currentBalance - record.lastITokenBalance;
        uint256 _start = record.lastITokenTime;
        uint256 _entireDuration = block.timestamp - _start;

        uint256 _currentWeek = (_start / WEEK) * WEEK;
        uint256 _nextWeek;
        record.lastITokenBalance = _currentBalance;
        record.lastITokenTime = block.timestamp;

        for (uint256 i = 0; i < 20; i++) {
            _nextWeek = _currentWeek + WEEK;

            // reached latest week, loop end
            if (block.timestamp < _nextWeek) {
                // no duration but balance increased
                if (_entireDuration == 0 && block.timestamp == _start) {
                    record.iTokenSupplyPerWeek[_currentWeek] = _distribution;
                }
                // decide the portion of distribution
                else {
                    uint256 _currentDuration = (block.timestamp - _start);
                    record.iTokenSupplyPerWeek[_currentWeek] =
                        (_distribution * _currentDuration) /
                        _entireDuration;
                }
                break;
            }
            // unrecorded weeks remaining, loop continue
            else {
                if (_entireDuration == 0 && _nextWeek == _start) {
                    record.iTokenSupplyPerWeek[_currentWeek] += _distribution;
                } else {
                    uint256 _currentDuration = (_nextWeek - _start);
                    record.iTokenSupplyPerWeek[_currentWeek] +=
                        (_distribution * _currentDuration) /
                        _entireDuration;
                }
            }

            _start = _nextWeek;
            _currentWeek = _nextWeek;
        }

        emit ITokenCheckpointed(record.lastITokenTime);
    }
}
