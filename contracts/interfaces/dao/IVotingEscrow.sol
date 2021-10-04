pragma solidity 0.8.7;
//SPDX-License-Identifier: MIT
interface IVotingEscrow {
    function get_last_user_slope(address addr)external view returns(uint256);
    function locked__end(address _addr)external view returns (uint256);

    function balanceOf(address addr , uint256 _t)external view returns (uint256);
    //function balanceOf(address addr)external view returns (uint256);
    function totalSupply(uint256 t)external view returns (uint256);
    function get_user_point_epoch(address _user)external view returns(uint256);
    function user_point_history__ts(address _addr, uint256 _idx)external view returns (uint256);
}