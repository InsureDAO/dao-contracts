pragma solidity ^0.6.0;
//SPDX-License-Identifier: MIT
import "./dao/IGaugeController.sol";
interface IMinter {
    function insure_token()external view returns(address);
    function controller()external view returns(address);
    function minted(address user, address gauge) external view returns(uint256);
    function gauge_controller()external view returns(address);
}