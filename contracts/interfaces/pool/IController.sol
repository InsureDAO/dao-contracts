pragma solidity ^0.7.5;

interface IController {
    function withdraw(address, uint256) external;

    function valueAll() external view returns (uint256);

    function earn(address, uint256) external;

    function migrate(address) external;
}
