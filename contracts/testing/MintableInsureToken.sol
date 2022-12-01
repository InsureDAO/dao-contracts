// SPDX-License-Identifier: Unlicense
pragma solidity 0.8.10;

import {InsureToken} from "../InsureToken.sol";

error UserAlreadyMinted();

contract MintableInsureToken is InsureToken {
    uint256 constant MINTABLE_PER_USER = 10_000 * 10**18;

    mapping(address => bool) public minted;

    modifier firstMint() {
        if (minted[msg.sender]) revert UserAlreadyMinted();
        _;
    }

    constructor(
        string memory _name,
        string memory _symbol,
        address _ownership
    ) InsureToken(_name, _symbol, _ownership) {}

    function testnetMint() external firstMint {
        minted[msg.sender] = true;
        _mint(msg.sender, MINTABLE_PER_USER);
    }

    function testnetMint(address _to) external firstMint {
        minted[msg.sender] = true;
        _mint(_to, MINTABLE_PER_USER);
    }
}
