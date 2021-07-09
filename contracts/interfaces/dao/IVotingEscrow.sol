pragma solidity 0.6.12;
//SPDX-License-Identifier: MIT
interface IVotingEscrow {
    function get_last_user_slope(address addr)external view returns(uint256);
    function locked__end(address _addr)external view returns (uint256);
}