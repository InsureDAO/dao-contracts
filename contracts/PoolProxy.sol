pragma solidity 0.8.7;

/***
*@title PoolProxy
*@author InsureDAO
* SPDX-License-Identifier: MIT
*@notice Ownership proxy for Insurance Pools
*/

//dao-contracts
import "./interfaces/dao/IDistributor.sol";

//pool-contracts
import "./interfaces/pool/IFactory.sol";
import "./interfaces/pool/IFeeModel.sol";
import "./interfaces/pool/IIndexTemplate.sol";
import "./interfaces/pool/IParameters.sol";
import "./interfaces/pool/IPoolTemplate.sol";
import "./interfaces/pool/IPremiumModel.sol";
import "./interfaces/pool/IRegistry.sol";
import "./interfaces/pool/IUniversalMarket.sol";
import "./interfaces/pool/IVault.sol";

//libraries
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/utils/math/SignedSafeMath.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";


contract PoolProxy is ReentrancyGuard{
    using SafeMath for uint256;
    using SafeERC20 for IERC20;


    event CommitAdmins(address ownership_admin, address parameter_admin, address emergency_admin);
    event ApplyAdmins(address ownership_admin, address parameter_admin, address emergency_admin); 
    event CommitDefaultReportingAdmin(address default_reporting_admin);
    event AcceptDefaultReportingAdmin(address default_reporting_admin);
    event SetReportingAdmin(address pool, address reporter);

    event AddDistributor(address distributor);


    address public ownership_admin;
    address public parameter_admin;
    address public emergency_admin;
    address public default_reporting_admin; //default reporting module address when arbitrary reporting module is not set.
    mapping(address => address)public reporting_admin; //Pool => Payout Decision Maker's address. (ex. ReportingDAO)

    address parameters; //pool-contracts Parameters.sol

    address public future_ownership_admin;
    address public future_parameter_admin;
    address public future_emergency_admin;
    address public future_default_reporting_admin;

    struct Distributor{
        string name;
        address addr;
    }

    /***
    USDC
    id 0 = dev
    id 1 = buy back and burn
    id 2 = reporting member
    */

    mapping(address => mapping(uint256 => Distributor))public distributors; // token distibutor contracts. token => ID => Distributor / (ex. USDC => 1 => FeeDistributorV1)
    mapping(address => uint256) public n_distributors; //token => distrobutor#
    mapping(address => mapping(uint256 => uint256))public distributor_weight; // token => ID => weight
    mapping(address => mapping(uint256 => uint256))public distributable; //distributor => allocated amount
    mapping(address => uint256)public total_weights; //token => total allocation point

    bool public distributor_kill;

    constructor(
        address _ownership_admin,
        address _parameter_admin,
        address _emergency_admin
    ){
        ownership_admin = _ownership_admin;
        parameter_admin = _parameter_admin;
        emergency_admin = _emergency_admin;
    }


    //==================================[Fee Distributor]==================================//
    function add_distributor(address _token, string memory _name, address _addr)external returns(bool){
        /***
        *@notice add new distributor.
        *@dev distributor weight is 0 at the moment of addition.
        *@param _token address of fee token
        *@param _name FeeDistributor name
        *@param _addr FeeDistributor address
        */
        require(msg.sender == ownership_admin, "only ownership admin");
        require(_token != address(0), "_token cannot be zero address");

        Distributor memory new_distributor = Distributor({name: _name, addr: _addr});
        uint256 id = n_distributors[_token];
        distributors[_token][id] = new_distributor;
        n_distributors[_token] = n_distributors[_token].add(1);

        return true;
    }

    function _set_distributor(address _token, uint256 _id, Distributor memory _distributor)internal {
        /***
        *@notice overwrites new distributor to distributor already existed;
        *@dev new distributor takes over the old distributor's weight and distributable state;
        */
        require(_id < n_distributors[_token], "distributor not added yet");

        //if Distributor set to ZERO_ADDRESS, set the weight to 0.
        if(_distributor.addr == address(0)){
            _set_distributor_weight(_token, _id, 0);
        }

        distributors[_token][_id] = _distributor;
    }

    function set_distributor(address _token, uint256 _id, string memory _name, address _distributor)external {
        /***
        *@notice Set new distributor or name or both.
        *@dev id has to be added already.
        *@param _token Fee Token address
        *@param _id Distributor id
        *@param _name Distributor name
        *@param _distributor Distributor address
        */
        require(msg.sender == ownership_admin, "only ownership admin");

        Distributor memory new_distributor = Distributor(_name, _distributor);

        _set_distributor(_token, _id, new_distributor);
    }

    function _set_distributor_weight(address _token, uint256 _id, uint256 _weight)internal{
        /***
        *@notice set new weight to a distributor
        *@param _token fee token address
        *@param _id distributor id
        *@param _weight new weight of the distributor
        */
        require(_id < n_distributors[_token], "distributor not added yet");
        require(distributors[_token][_id].addr != address(0), "distributor not set");
        
        uint256 new_weight = _weight;
        uint256 old_weight = distributor_weight[_token][_id];

        //update distibutor weight and total_weight
        distributor_weight[_token][_id] = new_weight;
        total_weights[_token] = total_weights[_token].add(new_weight).sub(old_weight);
    }

    function set_distributor_weight(address _token, uint256 _id, uint256 _weight)external returns(bool){
        /***
        *@notice set new weight to a distributor
        *@param _token fee token address
        *@param _id distributor id
        *@param _weight new weight of the distributor
        */
        require(msg.sender == parameter_admin, "only parameter admin");

        _set_distributor_weight(_token, _id, _weight);

        return true;
    }

    function set_distributor_weight_many(address[20] memory _tokens, uint256[20] memory _ids, uint256[20] memory _weights)external{
        /***
        *@notice set new weights to distributors[20]
        *@param _tokens fee token addresses[20]
        *@param _ids distributor ids[20]
        *@param _weights new weights of the distributors[20]
        *@dev [20] 20 is ramdomly decided and has no meaning.
        */
        require(msg.sender == parameter_admin, "only parameter admin");

        for(uint256 i=0; i<20; i++){
            if(_tokens[i] == address(0)){
                break;
            }
            _set_distributor_weight(_tokens[i], _ids[i], _weights[i]);
        }
    }

    function get_distributor_name(address _token, uint256 _id)external view returns(string memory){
        /***
        *@notice Get Function for distributor's name
        *@param _token fee token address
        *@param _id distributor id
        */
        return distributors[_token][_id].name;
    }

    function get_distributor_address(address _token, uint256 _id)external view returns(address){
        /***
        *@notice Get Function for distributor's address
        *@param _token fee token address
        *@param _id distributor id
        */
        return distributors[_token][_id].addr;
    }


    //==================================[Fee Distribution]==================================//
    function withdraw_admin_fee(address _token) external nonReentrant{
        /***
        *@notice Withdraw admin fees from `_vault`
        *@dev any account can execute this function 
        *@param _token fee token address to withdraw and allocate to the token's distributors
        */
        require(_token != address(0), "_token cannot be zero address");

        address _vault = IParameters(parameters).getVault(_token); //dev: revert when parameters not set
        uint256 amount = IVault(_vault).withdrawAllAttribution(address(this));

        if(amount != 0){
            //allocate the fee to corresponding distributors
            for(uint256 id=0; id<n_distributors[_token]; id++){
                uint256 aloc_point = distributor_weight[_token][id];

                uint256 aloc_amount = amount.mul(aloc_point).div(total_weights[_token]); //round towards zero.
                distributable[_token][id] = distributable[_token][id].add(aloc_amount); //count up the allocated fee
            }
        }
    }

    /***
    *@notice Re_allocate _token in this contract with the latest allocation. For token left after rounding down or switched to zero_address
    */
    /**
    function re_allocate(address _token)external{
        //re-allocate the all fee token in this contract with the current allocation.

        require(msg.sender == ownership_admin, "Access denied");

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
        /***
        *@notice distribute accrued `_token` via a preset distributor
        *@param _token fee token to be distributed
        *@param _id distributor id
        */
        require(_id < n_distributors[_token], "distributor not added yet");

        address _addr = distributors[_token][_id].addr;
        uint256 amount = distributable[_token][_id];
        distributable[_token][_id] = 0;

        IERC20(_token).safeApprove(_addr, amount);
        require(IDistributor(_addr).distribute(_token), "dev: should implement distribute()");
    }
    
    function distribute(address _token, uint256 _id)external nonReentrant{
        /***
        *@notice distribute accrued `_token` via a preset distributor
        *@dev Only callable by an EOA to prevent
        *@param _token fee token to be distributed
        *@param _id distributor id
        */
        assert(tx.origin == msg.sender); //only EOA
        require(!distributor_kill, "distributor is killed");

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


    //==================================[Configuration]==================================//
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

    function accept_set_admins()external{
        /***
        *@notice Accept the effects of `commit_set_admins`
        */
        require(msg.sender == future_ownership_admin, "Access denied");

        ownership_admin = future_ownership_admin;
        parameter_admin = future_parameter_admin;
        emergency_admin = future_emergency_admin;

        emit ApplyAdmins(ownership_admin, parameter_admin, emergency_admin);
    }

    //==================================[Reporting Module]==================================//
    function commit_set_default_reporting_admin(address _r_admin)external{
        /***
        *@notice Set reporting admin to `_r_admin`
        *@param _pool Target address
        *@param _r_admin Reporting admin
        */
        require(msg.sender == ownership_admin, "Access denied");

        future_default_reporting_admin = _r_admin;

        emit CommitDefaultReportingAdmin(future_default_reporting_admin);
    }

    function accept_set_default_reporting_admin()external{
        /***
        *@notice Accept the effects of `commit_set_default_reporting_admin`
        */
        require(msg.sender == future_default_reporting_admin, "Access denied");

        default_reporting_admin = future_default_reporting_admin;

        emit AcceptDefaultReportingAdmin(default_reporting_admin);
    }

    function set_reporting_admin(address _pool, address _reporter)external returns(bool){
        /***
        *@notice set arbitrary reporting module for specific _pool.
        *@notice "ownership_admin" or "default_reporting_admin" can execute this function.
        */
        require(address(msg.sender) == ownership_admin || address(msg.sender) == default_reporting_admin, "Access denied");


        reporting_admin[_pool] = _reporter;

        emit SetReportingAdmin(_pool, _reporter);

        return true;
    }

    function get_reporter(address _pool)public view returns(address){
        /***
        *@notice get reporting module set for the _pool. If none is set, default_reporting_admin will be returned.
        *@dev public function
        */

        address reporter = reporting_admin[_pool] != address(0) ? reporting_admin[_pool] : default_reporting_admin;

        return reporter;
    }


    //==================================[Pool Contracts]==================================//
    /***
    * pool-contracts' owner is this contract. 
    * For the detail of each function, see the pool-contracts repository.
    */

    //Factory
    function approve_template(address _factory, address _template_addr, bool _approval, bool _isOpen, bool _duplicate)external{
        require(msg.sender == ownership_admin, "Access denied");
        IUniversalMarket _template = IUniversalMarket(_template_addr);

        IFactory(_factory).approveTemplate(_template, _approval, _isOpen, _duplicate);
    }

    function approve_reference(address _factory, address _template_addr, uint256 _slot, address _target, bool _approval)external{

        require(msg.sender == ownership_admin, "Access denied");
        IUniversalMarket _template = IUniversalMarket(_template_addr);

        IFactory(_factory).approveReference(_template, _slot, _target, _approval);
    }

    function set_condition_factory(address _factory, address _template_addr, uint256 _slot, uint256 _target)external{
        require(msg.sender == ownership_admin, "Access denied");
        IUniversalMarket _template = IUniversalMarket(_template_addr);

        IFactory(_factory).setCondition(_template, _slot, _target);
    }

    function create_market(
        address _factory,
        address _template_addr,
        string memory _metaData,
        uint256[] memory _conditions,
        address[] memory _references
    ) external returns (address){
        require(msg.sender == ownership_admin, "Access denied");
        IUniversalMarket _template = IUniversalMarket(_template_addr);

        address _market = IFactory(_factory).createMarket(
                                _template,
                                _metaData,
                                _conditions,
                                _references
                            );
        
        return _market;
    }

    function commit_transfer_ownership_factory(address _factory, address _future_admin)external{

        require(msg.sender == ownership_admin, "Access denied");
        IFactory(_factory).commitTransferOwnership(_future_admin);
    }

    function apply_transfer_ownership_factory(address _factory)external{

        IFactory(_factory).applyTransferOwnership();
    }



    //FeeModel
    function set_fee(address _fee, uint256 _target)external{

        require(msg.sender == parameter_admin, "Access denied");
        IFeeModel(_fee).setFee(_target);
    }

    function commit_transfer_ownership_feemodel(address _fee, address _future_owner)external{

        require(msg.sender == ownership_admin, "Access denied");
        IFeeModel(_fee).commitTransferOwnership(_future_owner);
    }

    function apply_transfer_ownership_feemodel(address _fee)external{

        IFeeModel(_fee).applyTransferOwnership();
    }


    //Premium model
    function set_premium(address _premium, uint256 _baseRatePerYear, uint256 _multiplierPerYear)external{
        
        require(msg.sender == parameter_admin, "Access denied");
        IPremiumModel(_premium).setPremium(_baseRatePerYear, _multiplierPerYear);
    }

    function set_options(address _premium, uint256 _a, uint256 _b, uint256 _c, uint256 _d)external{
    
        require(msg.sender == parameter_admin, "Access denied");
        IPremiumModel(_premium).setOptions(_a, _b, _c, _d);
    }


    function commit_transfer_ownership_premiummodel(address _premium, address _future_owner)external{

        require(msg.sender == ownership_admin, "Access denied");
        IPremiumModel(_premium).commitTransferOwnership(_future_owner);

    }

    function apply_transfer_ownership_premiummodel(address _premium)external{

        IPremiumModel(_premium).applyTransferOwnership();
    }


    //Universal(Pool/Index/CDS)
    function set_paused(address _pool, bool _state)external nonReentrant{

        require(msg.sender == emergency_admin || msg.sender == ownership_admin, "Access denied");
        IUniversalMarket(_pool).setPaused(_state);
    }

    function change_metadata(address _pool, string calldata _metadata) external {
        require(msg.sender == parameter_admin, "Access denied");
        IUniversalMarket(_pool).changeMetadata(_metadata);
    }


    //Pool
    function apply_cover(
        address _pool,
        uint256 _pending,
        uint256 _payoutNumerator,
        uint256 _payoutDenominator,
        uint256 _incidentTimestamp,
        bytes32 _merkleRoot,
        bytes32[] calldata _rawdata,
        string calldata _memo
    ) external{
        require(msg.sender == reporting_admin[_pool], "Access denied");

        IPoolTemplate(_pool).applyCover(_pending, _payoutNumerator, _payoutDenominator, _incidentTimestamp, _merkleRoot, _rawdata, _memo);
    }


    //Index
    function set_leverage(address _index, uint256 _target)external{

        require(msg.sender == parameter_admin, "Access denied");

        IIndexTemplate(_index).setLeverage(_target);
    }


    function set(address _index_address, uint256 _index, address _pool, uint256 _allocPoint)external{
        require(msg.sender == parameter_admin, "Access denied");

        IIndexTemplate(_index_address).set(_index, _pool, _allocPoint);
    }


    //Vault
    function set_keeper(address _vault, address _keeper)external{

        require(msg.sender == ownership_admin, "Access denied");
        IVault(_vault).setKeeper(_keeper);
    }

    function set_controller(address _vault, address _controller)external{
        
        require(msg.sender == ownership_admin, "Access denied");
        IVault(_vault).setController(_controller);
    }

    function commit_transfer_ownership_vault(address _vault, address _future_owner)external{

        require(msg.sender == ownership_admin, "Access denied");
        IVault(_vault).commitTransferOwnership(_future_owner);
    }

    function apply_transfer_ownership_vault(address _vault)external{
        
        IVault(_vault).applyTransferOwnership();
    }


    //Parameters
    function set_parameters(address _parameters)external {
        /***
        * @notice set parameter contract
        */

        require(msg.sender == ownership_admin, "Access denied");
        parameters = _parameters;
    }

    function commit_transfer_ownership_parameters(address _parameters, address _future_owner)external{
        
        require(msg.sender == ownership_admin, "Access denied");
        IParameters(_parameters).commitTransferOwnership(_future_owner);
    }

    function apply_transfer_ownership_parameters(address _parameters)external{
        
        IParameters(_parameters).applyTransferOwnership();
    }

    function set_vault(address _parameters, address _token, address _vault)external{

        require(msg.sender == ownership_admin, "Access denied");

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

    function set_cds_premium(address _parameters, address _address, uint256 _target)external{

        require(msg.sender == parameter_admin, "Access denied");

        IParameters(_parameters).setCDSPremium(_address, _target);
    }

    function set_depositFee(address _parameters, address _address, uint256 _target)external{

        require(msg.sender == parameter_admin, "Access denied");

        IParameters(_parameters).setDepositFee(_address, _target);
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

    function set_max_list(address _parameters, address _address, uint256 _target)external{

        require(msg.sender == parameter_admin, "Access denied");
        IParameters(_parameters).setMaxList(_address, _target);
    }

    function set_condition_parameters(address _parameters, bytes32 _reference, bytes32 _target) external{

        require(msg.sender == parameter_admin, "Access denied");

        IParameters(_parameters).setCondition(_reference, _target);
    }


    //Registry
    function set_factory(address _registry, address _factory)external{

        require(msg.sender == ownership_admin, "Access denied");

        IRegistry(_registry).setFactory(_factory);
    }

    function support_market(address _registry, address _market) external{

        require(msg.sender == ownership_admin, "Access denied");
        IRegistry(_registry).supportMarket(_market);
    }

    function set_existence(address _registry, address _target, uint256 _typeId)external{

        require(msg.sender == ownership_admin, "Access denied");
        IRegistry(_registry).setExistence(_target, _typeId);
    }

    function set_cds(address _registry, address _address, address _target) external{

        require(msg.sender == ownership_admin, "Access denied");
        IRegistry(_registry).setCDS(_address, _target);
    }

    function commit_transfer_ownership_registry(address _registry, address _future_admin)external{

        require(msg.sender == ownership_admin, "Access denied");
        IRegistry(_registry).commitTransferOwnership(_future_admin);
    }

    function apply_transfer_ownership_registry(address _registry)external{
        
        IRegistry(_registry).applyTransferOwnership();
    }
}