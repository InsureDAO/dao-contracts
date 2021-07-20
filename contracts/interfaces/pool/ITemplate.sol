pragma solidity ^0.6.0;
//SPDX-License-Identifier: MIT
interface ITemplate {

    function withdrawFees(address) external returns(uint256);

    function setPaused(bool) external;

    function transferFrom(address, address, uint256)external returns(bool);

    function transfer(address, uint256)external returns(bool);

    function changeMetadata(string calldata)external;

    function applyCover(
        uint256,
        uint256,
        uint256,
        uint256,
        bytes32[] calldata
    ) external;

    function applyCover(uint256 _pending) external;

    function reportIncident(uint256 _pending, uint256 _incidentTimestamp)external;

    function allocateCredit(uint256 _credit)
        external
        
        returns (uint256 _mintAmount);

    function allocatedCredit(address _index)
        external
        view
        returns (uint256);

    function withdrawCredit(uint256 _credit)
        external
        returns (uint256 _retVal);

    function pendingPremium(address _index)
        external
        view
        returns (uint256);

}