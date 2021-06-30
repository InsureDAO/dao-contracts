pragma solidity 0.6.12;

/***
*@title PoolProxy
*@author InsureDAO
*SPDX-License-Identifier: MIT
*@notice Ownership proxy for Insurance Pools
*/
//This contracts hold many tokens to be distributed.

import "./interfaces/ITemplate.sol";
import "./interfaces/IDistributor.sol";
import "./interfaces/IRegistry.sol";
import "./interfaces/IParameters.sol";
import "./interfaces/IVault.sol";
import "./interfaces/IFactory.sol";
import "./interfaces/IUniversalMarket.sol";


import "./libraries/token/ERC20/IERC20.sol";
import "./libraries/math/Math.sol";
import "./libraries/math/SafeMath.sol";
import "./libraries/math/SignedSafeMath.sol";
import "./libraries/utils/ReentrancyGuard.sol";

//Proxy and fee management for single asset
contract PoolProxy is ReentrancyGuard{
    using SafeMath for uint256;

    event CommitAdmins(address ownership_admin, address parameter_admin, address emergency_admin);
    event ApplyAdmins(address ownership_admin, address parameter_admin, address emergency_admin); 
    event CommitReportingAdmins(address pool_address, address reporting_admin);
    event ApplyReportingAdmins(address pool_address, address reporting_admin);
    event AddDistributor(address distributor);


    address public ownership_admin;
    address public parameter_admin;
    address public emergency_admin;
    mapping(address => address)public reporting_admin;

    address registry;

    address public future_ownership_admin;
    address public future_parameter_admin;
    address public future_emergency_admin;
    mapping(address => address)public future_reporting_admin;

    struct Distributor{
        string name;
        address addr;
    }

    /***
    DAI
    id 1 = dev
    id 2 = buy back and burn
    id 3 = reporting member
    */

    mapping(address => mapping(uint256 => Distributor))public distributors; // token distibutor contracts. token => ID => Distributor / (ex. DAI => 2 => FeeDistributorV1)
    mapping(address => uint256) public n_distributors; //distributors# of token
    mapping(address => mapping(uint256 => uint256))public distributor_weight; // token => ID => weight
    mapping(address => mapping(uint256 => uint256))public distributable; //distributor => allocated amount
    mapping(address => uint256)public total_weights; //token => total allocation point

    bool public distributor_kill;

    constructor(
        address _ownership_admin,
        address _parameter_admin,
        address _emergency_admin
    )public{
        ownership_admin = _ownership_admin;
        parameter_admin = _parameter_admin;
        emergency_admin = _emergency_admin;
    }

    //-------- distributor ---------//
    function add_distributor(address _token, string memory _name, address _addr)external returns(bool){
        /***
        *@notice add new distributor
        */
        require(msg.sender == ownership_admin, "only ownership admin");
        require(_token != address(0), "_token cannot be zero address");


        Distributor memory new_distributor = Distributor({name: _name, addr: _addr});
        uint256 id = n_distributors[_token];
        distributors[_token][id] = new_distributor;
        n_distributors[_token] = n_distributors[_token].add(1);
        //distributor weight is 0 at this point.
    }

    function _set_distributor(address _token, uint256 _id, Distributor memory _distributor)internal {
        /***
        *@notice overwrites new distributor to distributor already existed;
        *@dev new distributor takes over the old distributor's weight and distributable state;
        */
        require(_id < n_distributors[_token], "not added yet");

        //if Distributor set to ZERO_ADDRESS, set the weight to 0.
        if(_distributor.addr == address(0)){
            _set_distributor_weight(_token, _id, 0);
        }

        distributors[_token][_id] = _distributor;
    }

    function set_distributor(address _token, uint256 _id, string memory _name, address _distributor)external {
        /***
        *@notice Set burner of `_coin` to `_burner` address
        *@param _token Token address
        *@param _id Distribution ID
        *@param _name Distributor name
        *@param _distributor Distributor contract address
        */
        require(msg.sender == ownership_admin, "only ownership admin");

        Distributor memory new_distributor = Distributor(_name, _distributor);

        _set_distributor(_token, _id, new_distributor);
    }

    function _set_distributor_weight(address _token, uint256 _id, uint256 _weight)internal{
        require(_id < n_distributors[_token], "not added yet");
        require(distributors[_token][_id].addr != address(0), "distributor not set");
        
        uint256 new_weight = _weight;
        uint256 old_weight = distributor_weight[_token][_id];

        //update distibutor weight and total_weight
        distributor_weight[_token][_id] = new_weight;
        total_weights[_token] = total_weights[_token].add(new_weight).sub(old_weight);
    }

    function set_distributor_weight(address _token, uint256 _id, uint256 _weight)external returns(bool){
        require(msg.sender == parameter_admin, "only parameter admin");

        _set_distributor_weight(_token, _id, _weight);

        return true;
    }

    function set_distributor_weight_many(address[20] memory _tokens, uint256[20] memory _ids, uint256[20] memory _weights)external{
        require(msg.sender == parameter_admin, "only parameter admin");

        for(uint256 i=0; i<20; i++){
            if(_tokens[i] == address(0)){
                break;
            }
            _set_distributor_weight(_tokens[i], _ids[i], _weights[i]);
        }
    }

    function get_distributor_name(address _token, uint256 _id)external view returns(string memory){
        return distributors[_token][_id].name;
    }

    function get_distributor_address(address _token, uint256 _id)external view returns(address){
        return distributors[_token][_id].addr;
    }

    //------------- distribution ----------------//
    function withdraw_admin_fee(address _token) external nonReentrant{//any accounts
        /***
        *@notice Withdraw admin fees from `_vault`
        *@param _vault Vault address to withdraw admin fees from
        */
        //Do we really need nonReentrant for this?
        require(_token != address(0), "_token cannot be zero address");

        address _vault = IRegistry(registry).getVault(_token); //dev: revert when registry not set
        uint256 amount = IVault(_vault).withdrawAllAttribution(address(this));

        if(amount != 0){
            //allocate the fee to corresponding distributors
            for(uint256 id=0; id<n_distributors[_token]; id++){
                uint256 aloc_point = distributor_weight[_token][id];

                uint256 aloc_amount = amount.mul(aloc_point).div(total_weights[_token]); //round towards zero.
                distributable[_token][id] = distributable[_token][id].add(aloc_amount); //count up allocated fee
            }
        }
    }

    /***
    *@notice Re_allocate _token in this contract with the latest allocation. For token left after rounding down
    */
    /**
    function re_allocate(address _token)external{
        require(msg.sender == parameter_admin, "only parameter admin");

        uint256 amount = IERC20(_token).balanceOf(address(this));

        //allocate the fee to corresponding distributors
        for(uint256 id=0; id<n_distributors[_token]; id++){
            uint256 aloc_point = distributor_weight[_token][id];

            uint256 aloc_amount = amount.mul(aloc_point).div(total_weights[_token]); //round towards zero.
            distributable[_token][id] = aloc_amount;
        }
    }
    */

    function _distribute(address _token, uint256 _id)internal{
        require(_id < n_distributors[_token], "not added yet");

        address _addr = distributors[_token][_id].addr;
        uint256 amount = distributable[_token][_id];
        distributable[_token][_id] = 0;
        IERC20(_token).approve(_addr, amount);
        require(IDistributor(_addr).distribute(_token), "dev: should implement distribute()");
    }
    
    function distribute(address _token, uint256 _id)external nonReentrant{//any EOA
        /***
        *@notice distribute accrued `_token` via a preset distributor
        *@dev Only callable by an EOA to prevent
        *@param _id distributor id
        */
        assert(tx.origin == msg.sender);
        require(!distributor_kill, "distribution killed");

        _distribute(_token, _id);
    }

    function distribute_many(address[20] memory _tokens, uint256[20] memory _ids)external nonReentrant{//any EOA
        /***
        *@notice distribute accrued admin fees from multiple coins
        *@dev Only callable by an EOA to prevent flashloan exploits
        *@param _id List of distributor id
        */
        assert(tx.origin == msg.sender);
        require(!distributor_kill, "distribution killed");

        for(uint i=0; i < 20; i++){
            if(_tokens[i] == address(0)){
                break;
            }
            _distribute(_tokens[i], _ids[i]);
        }
    }

    function set_distributor_kill(bool _is_killed)external{
        /***
        @notice Kill or unkill `distribute` functionality
        @param _is_killed Distributor kill status
        */
        require(msg.sender == emergency_admin || msg.sender == ownership_admin, "Access denied");
        distributor_kill = _is_killed;
    }


    //-------- configuration ---------//
    // admins
    function commit_set_admins(address _o_admin, address _p_admin, address _e_admin)external{
        /***
        *@notice Set ownership admin to `_o_admin`, parameter admin to `_p_admin` and emergency admin to `_e_admin`
        *@param _o_admin Ownership admin
        *@param _p_admin Parameter admin
        *@param _e_admin Emergency admin
        */
        require(msg.sender == ownership_admin, "Access denied");

        future_ownership_admin = _o_admin;
        future_parameter_admin = _p_admin;
        future_emergency_admin = _e_admin;

        emit CommitAdmins(_o_admin, _p_admin, _e_admin);
    }
    function apply_set_admins()external{
        /***
        *@notice Apply the effects of `commit_set_admins`
        */
        require( msg.sender == ownership_admin, "Access denied");

        address _o_admin = future_ownership_admin;
        address _p_admin = future_parameter_admin;
        address _e_admin = future_emergency_admin;

        ownership_admin = _o_admin;
        parameter_admin = _p_admin;
        emergency_admin = _e_admin;

        emit ApplyAdmins(_o_admin, _p_admin, _e_admin);
    }

    // reporting admins
    function commit_set_reporting_admin(address _pool, address _r_admin)external{
        /***
        *@notice Set reporting admin to `_r_admin`
        *@param _pool Target address
        *@param _r_admin Reporting admin
        */
        require(msg.sender == ownership_admin, "Access denied");

        future_reporting_admin[_pool] = _r_admin;

        emit CommitReportingAdmins(_pool, _r_admin);
    }

    function apply_set_reporting_admin(address _pool)external{
        /***
        *@notice Apply the effects of `commit_set_reporting_admin`
        */
        require(msg.sender == ownership_admin, "Access denied");
        require(future_reporting_admin[_pool] != address(0), "future admin not set");
        address _r_admin = future_reporting_admin[_pool];

        reporting_admin[_pool] = _r_admin;

        emit ApplyReportingAdmins(_pool, _r_admin);
    }



    //--------------Vault-----------------//
    function commit_transfer_ownership_vault(address _vault, address _future_owner)external{
        /***
        *@param _vault address of Vault contract of the Vault
        *@param _future_owner address of the future owner
        */
        require(msg.sender == ownership_admin, "Access denied");
        IVault(_vault).commit_transfer_ownership(_future_owner);

    }

    function apply_transfer_ownership_vault(address _vault)external{
        /***
        *@notice 
        *@param _vault Vault address
        */
        
        IVault(_vault).apply_transfer_ownership();
    }

    function set_controller(address _vault, address _controller)external{
        /***
        *@param _vault Vault address
        *@param _controller new controller address
        */
        require(msg.sender == parameter_admin, "Access denied");

        IVault(_vault).setController(_controller);
    }

    function set_min(address _vault, uint256 _min)external {
        /***
        *@notice how much can the vault can lend out to controller
        *@param _vault Vault address
        *@param _min minimum
        */
        require(msg.sender == parameter_admin, "Access denied");

        IVault(_vault).setMin(_min);
    }


    //--------------Parameters-----------------//
    function commit_transfer_ownership_parameters(address _parameters, address _future_owner)external{
        /***
        *@param _parameters Parameters address
        *@param _future_owner address of the future owner
        */
        require(msg.sender == ownership_admin, "Access denied");
        IParameters(_parameters).commit_transfer_ownership(_future_owner);
    }

    function apply_transfer_ownership_parameters(address _parameters)external{
        /***
        *@param _parameters Parameters address
        */
        IParameters(_parameters).apply_transfer_ownership();
    }

    function set_vault(address _parameters, address _token, address _vault)external{
        require(msg.sender == parameter_admin, "Access denied");

        IParameters(_parameters).setVault(_token, _vault);
    }

    function set_lockup(address _parameters, address _address, uint256 _target)external{
        require(msg.sender == parameter_admin, "Access denied");

        IParameters(_parameters).setLockup(_address, _target);
    }

    function set_grace(address _parameters, address _address, uint256 _target)external{
        require(msg.sender == parameter_admin, "Access denied");

        IParameters(_parameters).setGrace(_address, _target);
    }

    function set_mindate(address _parameters, address _address, uint256 _target)external{
        require(msg.sender == parameter_admin, "Access denied");

        IParameters(_parameters).setMindate(_address, _target);
    }

    function set_premium2(address _parameters, address _address, uint256 _target)external{
        require(msg.sender == parameter_admin, "Access denied");

        IParameters(_parameters).setPremium2(_address, _target);
    }

    function set_fee2(address _parameters, address _address, uint256 _target)external{
        require(msg.sender == parameter_admin, "Access denied");

        IParameters(_parameters).setFee2(_address, _target);
    }

    function set_withdrawable(address _parameters, address _address, uint256 _target)external{
        require(msg.sender == parameter_admin, "Access denied");

        IParameters(_parameters).setWithdrawable(_address, _target);
    }

    function set_premium_model(address _parameters, address _address, address _target)external{
        require(msg.sender == parameter_admin, "Access denied");

        IParameters(_parameters).setPremiumModel(_address, _target);
    }

    function set_fee_model(address _parameters, address _address, address _target)external{
        require(msg.sender == parameter_admin, "Access denied");

        IParameters(_parameters).setFeeModel(_address, _target);
    }

    function set_condition_parameters(address _parameters, bytes32 _reference, bytes32 _target) external{
        require(msg.sender == parameter_admin, "Access denied");

        IParameters(_parameters).setCondition(_reference, _target);
    }


    //--------------Registry-----------------//
    function set_registry(address _registry)external {
        require(msg.sender == ownership_admin, "Access denied");
        registry = _registry;
    }

    function commit_transfer_ownership_registry(address _registry, address _future_admin)external{
        require(msg.sender == ownership_admin, "Access denied");
        IRegistry(_registry).commit_transfer_ownership(_future_admin);
    }

    function apply_transfer_ownership_registry(address _registry)external{
        /***
        *@param _registry Registry address
        */
        IRegistry(_registry).apply_transfer_ownership();
    }

    function support_market(address _registry, address _market) external{
        require(msg.sender == parameter_admin, "Access denied");
        IRegistry(_registry).supportMarket(_market);
    }

    function set_cds(address _registry, address _address, address _target) external{
        require(msg.sender == parameter_admin, "Access denied");
        IRegistry(_registry).setCDS(_address, _target);
    }


    //--------------Factory-----------------//
    function commit_transfer_ownership_factory(address _factory, address _future_admin)external{
        require(msg.sender == ownership_admin, "Access denied");
        IFactory(_factory).commit_transfer_ownership(_future_admin);
    }

    function apply_transfer_ownership_factory(address _factory)external{
        /***
        *@param _factory Factory address
        */
        IFactory(_factory).apply_transfer_ownership();
    }

    function approve_reference(address _factory, address _template_addr, uint256 _slot, address _target, bool _approval)external{
        require(msg.sender == parameter_admin, "Access denied");
        IUniversalMarket _template = IUniversalMarket(_template_addr);

        IFactory(_factory).approveReference(_template, _slot, _target, _approval);
    }

    function approve_template(address _factory, address _template_addr, bool _approval, bool _isOpen)external{
        require(msg.sender == parameter_admin, "Access denied");
        IUniversalMarket _template = IUniversalMarket(_template_addr);

        IFactory(_factory).approveTemplate(_template, _approval, _isOpen);
    }

    function set_condition_factory(address _factory, address _template_addr, uint256 _slot, uint256 _target)external{
        require(msg.sender == parameter_admin, "Access denied");
        IUniversalMarket _template = IUniversalMarket(_template_addr);

        IFactory(_factory).setCondition(_template, _slot, _target);
    }


    //--------------Pool-----------------//
    function set_paused(address _pool, bool _state)external nonReentrant{
        /***
        *@notice 
        *@param _pool Pool address to pause
        */
        require(msg.sender == emergency_admin || msg.sender == ownership_admin, "Access denied");
        ITemplate(_pool).setPaused(_state);
    }

    function change_metadata(address _pool, string calldata _metadata) external {
        require(msg.sender == parameter_admin, "Access denied");
        ITemplate(_pool).changeMetadata(_metadata);
    }

    function apply_cover(
        address _pool,
        uint256 _pending,
        uint256 _payoutNumerator,
        uint256 _payoutDenominator,
        uint256 _incidentTimestamp,
        bytes32[] calldata _targets
    ) external{
        require(msg.sender == reporting_admin[_pool], "Access denied");

        ITemplate(_pool).applyCover(_pending, _payoutNumerator, _payoutDenominator, _incidentTimestamp, _targets);
    }

    fallback()external payable{
        // required to receive ETH fees
    }

}