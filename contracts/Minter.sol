pragma solidity 0.8.10;

/***
 *@title Token Minter
 *@author InsureDAO
 * SPDX-License-Identifier: MIT
 *@notice Used to mint InsureToken
 */

//dao-contracts
import "./interfaces/dao/IInsureToken.sol";
import "./interfaces/dao/ILiquidityGauge.sol";
import "./interfaces/dao/IGaugeController.sol";
import "./interfaces/dao/IEmergencyMintModule.sol";

import "./interfaces/pool/IOwnership.sol";

//libraries
import "@openzeppelin/contracts/utils/math/Math.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract Minter is ReentrancyGuard {
    event EmergencyMint(uint256 minted);
    event Minted(address indexed recipient, address gauge, uint256 minted);
    event SetConverter(address converter);

    IInsureToken public insure_token;
    IGaugeController public gauge_controller;
    IEmergencyMintModule public emergency_module;

    // user -> gauge -> value
    mapping(address => mapping(address => uint256)) public minted; //INSURE minted amount of user from specific gauge.

    // minter -> user -> can mint?
    mapping(address => mapping(address => bool)) public allowed_to_mint_for; // A can mint for B if [A => B => true].

    IOwnership public immutable ownership;

    modifier onlyOwner() {
        require(
            ownership.owner() == msg.sender,
            "Caller is not allowed to operate"
        );
        _;
    }

    constructor(
        address _token,
        address _controller,
        address _ownership
    ) {
        insure_token = IInsureToken(_token);
        gauge_controller = IGaugeController(_controller);
        ownership = IOwnership(_ownership);
    }

    function _mint_for(address gauge_addr, address _for) internal {
        require(
            gauge_controller.gauge_types(gauge_addr) > 0,
            "dev: gauge is not added"
        );

        ILiquidityGauge(gauge_addr).user_checkpoint(_for);
        uint256 total_mint = ILiquidityGauge(gauge_addr).integrate_fraction(
            _for
        ); //Total amount of both mintable and minted.
        uint256 to_mint = total_mint - minted[_for][gauge_addr]; //mint amount for this time. (total_amount - minted = mintable)

        if (to_mint != 0) {
            insure_token.mint(_for, to_mint);
            minted[_for][gauge_addr] = total_mint;

            emit Minted(_for, gauge_addr, total_mint);
        }
    }

    /***
     *@notice Mint everything which belongs to `msg.sender` and send to them
     *@param gauge_addr `LiquidityGauge` address to get mintable amount from
     */
    function mint(address gauge_addr) external nonReentrant {
        _mint_for(gauge_addr, msg.sender);
    }

    /***
     *@notice Mint everything which belongs to `msg.sender` across multiple gauges
     *@param gauge_addrs List of `LiquidityGauge` addresses
     *@dev address[8]: 8 has randomly decided and has no meaning.
     */
    function mint_many(address[8] memory gauge_addrs) external nonReentrant {
        for (uint256 i; i < 8; ) {
            if (gauge_addrs[i] == address(0)) {
                break;
            }
            _mint_for(gauge_addrs[i], msg.sender);
            unchecked {
                ++i;
            }
        }
    }

    /***
     *@notice Mint tokens for `_for`
     *@dev Only possible when `msg.sender` has been approved via `toggle_approve_mint`
     *@param gauge_addr `LiquidityGauge` address to get mintable amount from
     *@param _for Address to mint to
     */
    function mint_for(address gauge_addr, address _for) external nonReentrant {
        if (allowed_to_mint_for[msg.sender][_for]) {
            _mint_for(gauge_addr, _for);
        }
    }

    /***
     *@notice allow `minting_user` to mint for `msg.sender`
     *@param minting_user Address to toggle permission for
     */
    function toggle_approve_mint(address minting_user) external {
        allowed_to_mint_for[minting_user][msg.sender] = !allowed_to_mint_for[
            minting_user
        ][msg.sender];
    }

    //-----------------emergency mint-----------------/

    function set_emergency_mint_module(address _emergency_module)
        external
        onlyOwner
    {
        emergency_module = IEmergencyMintModule(_emergency_module);
    }

    /***
     *@param mint_amount amount of INSURE to be minted
     */
    function emergency_mint(uint256 _mint_amount) external {
        require(msg.sender == address(emergency_module), "onlyOwner");

        //mint
        insure_token.emergency_mint(_mint_amount, address(emergency_module));

        emit EmergencyMint(_mint_amount);
    }
}
