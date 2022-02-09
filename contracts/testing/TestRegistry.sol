pragma solidity 0.8.10;
//SPDX-License-Identifier: MIT

contract TestRegistry{
    constructor()public{
    }

    mapping(address => address) public vaults;
    
    function isListed(address _market) external pure returns (bool) {
        if(_market == address(0)){
            return false;
        }else{
            return true;
        }
    }

    function setVault(address _token, address _vault)external {
        vaults[_token] = _vault;
    }

    function getVault(address _token)external view returns(address){
        return vaults[_token];
    }


}