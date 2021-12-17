pragma solidity 0.8.7;

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

//libraries
import "@openzeppelin/contracts/utils/math/Math.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract Minter is ReentrancyGuard {
    event EmergencyMint(uint256 minted);
    event Minted(address indexed recipient, address gauge, uint256 minted);
    event SetAdmin(address admin);
    event SetConverter(address converter);

    IInsureToken public insure_token;
    IGaugeController public gauge_controller;
    IEmergencyMintModule public emergency_module;

    address public admin;

    // user -> gauge -> value
    mapping(address => mapping(address => uint256)) public minted; //INSURE minted amount of user from specific gauge.

    // minter -> user -> can mint?
    mapping(address => mapping(address => bool)) public allowed_to_mint_for; // A can mint for B if [A => B => true].

    constructor(address _token, address _controller) {
        insure_token = IInsureToken(_token);
        gauge_controller = IGaugeController(_controller);
        admin = msg.sender;
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

    function mint(address gauge_addr) external nonReentrant {
        /***
         *@notice Mint everything which belongs to `msg.sender` and send to them
         *@param gauge_addr `LiquidityGauge` address to get mintable amount from
         */

        _mint_for(gauge_addr, msg.sender);
    }

    function mint_many(address[8] memory gauge_addrs) external nonReentrant {
        /***
         *@notice Mint everything which belongs to `msg.sender` across multiple gauges
         *@param gauge_addrs List of `LiquidityGauge` addresses
         *@dev address[8]: 8 has randomly decided and has no meaning.
         */

        for (uint256 i; i < 8; i++) {
            if (gauge_addrs[i] == address(0)) {
                break;
            }
            _mint_for(gauge_addrs[i], msg.sender);
        }
    }

    function mint_for(address gauge_addr, address _for) external nonReentrant {
        /***
         *@notice Mint tokens for `_for`
         *@dev Only possible when `msg.sender` has been approved via `toggle_approve_mint`
         *@param gauge_addr `LiquidityGauge` address to get mintable amount from
         *@param _for Address to mint to
         */

        if (allowed_to_mint_for[msg.sender][_for]) {
            _mint_for(gauge_addr, _for);
        }
    }

    function toggle_approve_mint(address minting_user) external {
        /***
         *@notice allow `minting_user` to mint for `msg.sender`
         *@param minting_user Address to toggle permission for
         */

        allowed_to_mint_for[minting_user][msg.sender] = !allowed_to_mint_for[
            minting_user
        ][msg.sender];
    }

    //-----------------emergency mint-----------------/
    function set_admin(address _admin) external {
        /***
         *@notice Set the new admin.
         *@dev After all is set up, admin only can change the token name
         *@param _admin New admin address
         */
        require(msg.sender == admin, "dev: admin only");
        admin = _admin;
        emit SetAdmin(_admin);
    }

    function set_emergency_mint_module(address _emergency_module) external {
        require(msg.sender == admin, "dev: admin only");
        emergency_module = IEmergencyMintModule(_emergency_module);
    }

    function emergency_mint(uint256 _mint_amount) external {
        /**
         *@param mint_amount amount of INSURE to be minted
         */
        require(msg.sender == address(emergency_module), "dev: admin only");

        //mint
        insure_token.emergency_mint(_mint_amount, address(emergency_module));

        emit EmergencyMint(_mint_amount);
    }
}
