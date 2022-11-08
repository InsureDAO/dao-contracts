// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.10;

import {VotingEscrow} from "../VotingEscrow.sol";

uint256 constant WEEK = 7 * 86_400;

library VeCheckpointLogic {
    struct VeCheckpoint {
        uint256[1e15] veSupplyPerWeek;
        uint256 latestTimeCursor;
    }
    event VeCheckpointed(uint256 _lastCheckpointTime);

    function checkpoint(address _votingEscrow, VeCheckpoint storage params)
        internal
    {
        // round by week
        uint256 _weekStartTs = (block.timestamp / WEEK) * WEEK;
        VotingEscrow(_votingEscrow).checkpoint();

        uint256 _timeCursor = params.latestTimeCursor;

        // record veINSURE supply each week
        for (uint256 i = 0; i < 20; i++) {
            if (_timeCursor > _weekStartTs) break;

            uint256 _epoch = _findGlobalEpoch(_votingEscrow, _timeCursor);
            (int256 _bias, int256 _slope, uint256 _ts, ) = VotingEscrow(
                _votingEscrow
            ).point_history(_epoch);

            int256 _dt = _timeCursor > _ts
                ? int256(_timeCursor - _ts)
                : int256(0);

            int256 _supply = _bias - _dt * _slope;

            params.veSupplyPerWeek[_timeCursor] = uint256(_supply);

            unchecked {
                _timeCursor += WEEK;
            }
        }

        params.latestTimeCursor = _timeCursor;

        emit VeCheckpointed(_timeCursor);
    }

    function _findGlobalEpoch(address _votingEscrow, uint256 _targetTs)
        private
        view
        returns (uint256)
    {
        uint256 _max = VotingEscrow(_votingEscrow).epoch();
        uint256 _min = 0;

        for (uint256 i = 0; i < 128; i++) {
            if (_min >= _max) break;
            uint256 _mid = (_min + _max + 2) / 2;

            (, , uint256 _ts, ) = VotingEscrow(_votingEscrow).point_history(
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
