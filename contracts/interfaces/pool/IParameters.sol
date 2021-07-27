pragma solidity ^0.6.0;
//SPDX-License-Identifier: MIT
interface IParameters {
    function commit_transfer_ownership(address _owner) external ;

    function apply_transfer_ownership() external ;

    function setVault(address _token, address _vault) external ;

    function setLockup(address _address, uint256 _target) external ;

    function setGrace(address _address, uint256 _target) external ;

    function setMindate(address _address, uint256 _target) external ;

    function setPremium2(address _address, uint256 _target) external ;

    function setFee2(address _address, uint256 _target) external ;

    function setWithdrawable(address _address, uint256 _target)
        external
        ;

    function setPremiumModel(address _address, address _target)
        external
        ;

    function setFeeModel(address _address, address _target) external ;

    function setCondition(bytes32 _reference, bytes32 _target) external ;

    function getVault(address _token) external view  returns (address);

    function getPremium(
        uint256 _amount,
        uint256 _term,
        uint256 _totalLiquidity,
        uint256 _lockedAmount,
        address _target
    ) external view  returns (uint256);

    function getFee(uint256 _amount, address _target)
        external
        view
        
        returns (uint256);

    function getLockup(address _target) external view  returns (uint256);

    function getWithdrawable(address _target)
        external
        view
        
        returns (uint256);

    function getGrace(address _target) external view  returns (uint256);

    function get_owner() external view  returns (address);

    function isOwner() external view  returns (bool);

    function getMin(address _target) external view  returns (uint256);

    function getFee2(uint256 _amoun, address _targett)
        external
        view
        
        returns (uint256);

    function getPremium2(uint256 _amount, address _target)
        external
        view
        
        returns (uint256);

    function getCondition(bytes32 _reference)
        external
        view
        
        returns (bytes32);
}
