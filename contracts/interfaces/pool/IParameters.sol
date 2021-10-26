pragma solidity 0.8.7;

interface IParameters {
    function commitTransferOwnership(address) external;

    function applyTransferOwnership() external ;

    function setVault(address, address) external ;

    function setLockup(address, uint256) external ;

    function setGrace(address _address, uint256 _target) external ;

    function setMindate(address _address, uint256 _target) external ;

    function setCDSPremium(address _address, uint256 _target) external ;

    function setDepositFee(address _address, uint256 _target) external ;

    function setWithdrawable(address _address, uint256 _target)external;

    function setPremiumModel(address _address, address _target)external;

    function setFeeModel(address _address, address _target) external ;

    function setMaxList(address, uint256) external;

    function setCondition(bytes32 _reference, bytes32 _target) external ;

    function getVault(address _token) external view returns (address);
}
