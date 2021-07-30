pragma solidity ^0.7.5;
//SPDX-License-Identifier: MIT
interface IGaugeController {
    function gauge_types(address _addr)external view returns(uint256);
}