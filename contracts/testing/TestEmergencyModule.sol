pragma solidity 0.8.7;
//SPDX-License-Identifier: MIT

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../Minter.sol";
import "../interfaces/pool/IVault.sol";

contract TestEmergencyModule{
  
  address public admin;
  address public minter;
  address public vault;

  constructor(address _minter){
      admin = msg.sender;
      minter = _minter;
  }

  function mint(uint256 mint_amount) external{
    //mint INSURE token
    require (msg.sender == admin, "dev: admin only");

    Minter(minter).emergency_mint(mint_amount);
  }

  function repayDebt(uint256 amount)external{
    //repay with USDC
    require (msg.sender == admin, "dev: admin only");

    IVault(vault).repayDebt(amount, address(0));
  }

}