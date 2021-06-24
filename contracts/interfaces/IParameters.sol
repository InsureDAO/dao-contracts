pragma solidity ^0.6.0;
//SPDX-License-Identifier: MIT
interface IParameters {
    function commit_transfer_ownership(address)external;

    function apply_transfer_ownership()external;

    function setLockup(address, uint256)external;

    function setGrace(address, uint256)external;

    function setMindate(address, uint256)external;

    function setPremium2(address, uint256)external;

    function setFee2(address, uint256)external;

    function setPremiumModel(address, address)external;

    function setFeeModel(address, address)external;

    function setVault(address, address)external;

    function setWithdrawable(address, uint256)external;

    function setCondition(bytes32 _reference, bytes32 _target)external;
}
