pragma solidity 0.8.10;
//SPDX-License-Identifier: MIT
/***
* Distribute part of admin fee to Reporting members;
* @dev assumes not more than one kind of token to be distributed.
*/

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";


contract ReportingFeeDistributor is ReentrancyGuard{
    using SafeERC20 for IERC20;

    event Distribution(uint256 amount, uint256 blocktime);
    event UpdateReportingMember(address _address, bool is_rpt);
    event Claim(address receiver, uint256 amount);
    event ChangeRecovery(address recovery);
    event CommitAdmin(address admin);
    event AcceptAdmin(address admin);

    address constant USDC = 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48; //mainnet USDC
    address public token;

    address public insure_reporting; //RPTINSURE address

    address public admin; //upgradable
    address public future_admin; 
    address public recovery; //upgradable
    bool public is_killed;
    
    mapping(uint256 => address) public reporters; //ID => address (0=unset)
    uint256 public reporters_length;

    mapping(address => bool) public has_registered;
    mapping(address => bool) public is_kicked;
    uint256 public active_reporter;

    uint256 public fee_total;
    uint256 public bonus_total;
    uint256 public bonus_ratio; //ratio of fee goes to bonus. 100 = 100%. initially 0%;
    uint256 public constant bonus_ratio_divider = 100;

    mapping(address => uint256) public claimable_fee;

    constructor(
        address _insure_reporting,
        address _recovery,
        address _admin,
        address _token
    ){
        /***
        *@notice Contract constructor
        *@param _insure_reporting InsureReportingToken conntract address(ReportingDAO)
        *@param _recovery Address to transfer `_token` balance to if this contract is killed
        *@param _admin Admin address
        *@param _token set for test. leave this address(0) when deploying in production.
        */

        require(_insure_reporting != address(0), "zero-address");
        require(_recovery != address(0), "zero-address");
        require(_admin != address(0), "zero-address");
        
        if(_token != address(0)){
            token = _token;
        }else{
            token = USDC;
        }
        
        insure_reporting = _insure_reporting;
        recovery = _recovery;
        admin = _admin;
    }

    //Reporter management
    function register_reporter(address _addr)external{
        /***
        * @notice register reporter
        * @param _addr address to be registered
        */
        require(_addr != address(0), "zero address");
        require(has_registered[_addr] == false, "already registered");

        if(IERC20(insure_reporting).balanceOf(_addr) != 0){
            reporters_length += 1;
            reporters[reporters_length] = _addr;
            has_registered[_addr] = true;
            active_reporter += 1;
        }
    }

    function _update_reporter(address _addr)internal nonReentrant returns(bool){
        /***
        * @notice update reporters
        * @param _addr address to be updated
        * @return bool (is RPT member now)
        */
        require(_addr != address(0), "zero address");

        if(has_registered[_addr]){
            if(IERC20(insure_reporting).balanceOf(_addr) != 0){
                if(is_kicked[_addr] == true){//kicked => not kicked
                    is_kicked[_addr] = false;
                    active_reporter += 1;
                }
                
                emit UpdateReportingMember(_addr, true);
                return true;
            }else{
                if(is_kicked[_addr] == false){//not kicked => kicked
                    is_kicked[_addr] = true;
                    active_reporter -= 1;
                }
                emit UpdateReportingMember(_addr, false);
                return false;
            }
        }else{
            emit UpdateReportingMember(_addr, false);
            return false; //not registered.
        }
    }

    function update_reporter(address _addr)external returns(bool){
        /***
        * @param _addr reporting member's address that is going to be updated
        * @return True if he is reporting member. False if he has kicked.
        */
        require(!is_killed, "dev: contract is killed");

        return _update_reporter(_addr);
    }

    function update_reporter_many(address[20] memory _addrs)external{
        require(!is_killed, "dev: contract is killed");

        for(uint256 i = 0; i<20; i++){
            if(_addrs[i] == address(0)){
                break;
            }

            _update_reporter(_addrs[i]);
        }
    }

    //Distribute
    function distribute(address _coin)external returns(bool){
        /***
        * @notice Recieve USDC into the contract and trigger a token checkpoint
        * @param _coin address of the coin being received (must be USDC)
        * @return bool success
        */
        require(_coin == token, "cannnot distribute this token");
        require(!is_killed, "dev: contract is killed");
        uint256 total_amount = IERC20(_coin).allowance(address(msg.sender), address(this)); //Amount of token PoolProxy allows me
        if(total_amount != 0){
            IERC20(_coin).safeTransferFrom(address(msg.sender), address(this), total_amount); //allowance will be 0

            uint256 bonus = total_amount * bonus_ratio / bonus_ratio_divider;
            bonus_total += bonus;
            fee_total += total_amount - bonus;

            if(fee_total != 0){
                //update all reporters & active_member#
                for(uint256 i=1; i <= reporters_length; i++){
                    address _addr = reporters[i];
                    _update_reporter(_addr); //this intentionaly returns both true or false
                }

                uint256 distributed;
                for(uint256 i=1; i <= reporters_length; i++){
                    address _addr = reporters[i];

                    if(!is_kicked[_addr]){//if not kicked
                        uint256 _amount = total_amount / active_reporter;
                        claimable_fee[_addr] += _amount;
                        distributed += _amount;
                    }
                }
                fee_total -= distributed;
            }

            emit Distribution(total_amount, block.timestamp);
        }

        return true;
    }

    function bonus_distribution(uint256[100] memory _ids, uint256[100] memory _allocations)external{
        /***
        * @notice Distribute Bonus based
        * @param _ids Reporter IDs
        * @param _allocations allocation points
        */
        require(address(msg.sender) == admin, "only admin");

        //calc total allocation point
        uint256 total_allocation; //0
        for(uint256 i=0;i<100;i++){
            if(_ids[i]!=0){
                require(i<= reporters_length);
                total_allocation += _allocations[i];
            }else{
                break;
            }
        }

        //distribute based on the allocation point.
        uint256 distributed;
        for(uint256 i=0;i<100;i++){
            if(_ids[i]!=0){
                //distribute all registerd address. (including kicked member for case he was kicked during the term)
                address _addr = reporters[_ids[i]];
                uint256 _amount = bonus_total * _allocations[i] / total_allocation;

                distributed += _amount;
                claimable_fee[_addr] += _amount;
            }else{
                break;
            }
        }
        bonus_total -= distributed;
    }


//Claim
    function _claim(address _addr)internal returns(uint256){
        require(claimable_fee[_addr] != 0, "no claimable fee");

        uint256 _amount = claimable_fee[_addr];
        claimable_fee[_addr] = 0;
        IERC20(token).safeTransfer(_addr, _amount);

        emit Claim(_addr, _amount);
        return _amount;
    }

    function claim()external nonReentrant returns(uint256){
        /***
        *@notice Claim fees for _addr
        *@param _addr Address to claim fees for
        *@return 
        */

        uint256 amount = _claim(msg.sender);

        return amount;
    }


//Config & Emergency
    function set_bonus_ratio(uint256 _ratio)external{
        require(address(msg.sender) == admin, "only admin");
        require(_ratio <= 100, "exceed max");

        bonus_ratio = _ratio;
    }

    function kill_me()external{
        /***
        *@notice Kill the contract
        *@dev claim() and recover_balance() are possible after the kill. CANNOT BE UNKILLED
        */
        require(address(msg.sender) == admin, "dev: admin only");
        require(recovery != address(0), "dev: recovery address is ZERO_ADDRESS");
        is_killed = true;
    }

    function recover_balance(address _coin)external returns(bool){
        /***
        *@notice Recover any ERC20 tokens from this contract
        *@dev Tokens are sent to the recovery address.
        *@param _coin Token address
        *@return bool success
        */
        require(address(msg.sender) == admin, "dev: admin only");
        require(recovery != address(0), "recovery to ZERO_ADDRESS");
        require(is_killed, "dev: not killed");

        uint256 amount = IERC20(_coin).balanceOf(address(this));
        if(amount != 0){
            IERC20(_coin).safeTransfer(recovery, amount);
        }

        return true;
    }

    function change_recovery(address _recovery)external returns(bool){
        /***
        *@notice Change the recovery address.
        *@param _recovery new recovery address
        *@return bool success
        */

        require(address(msg.sender) == admin, "dev: admin only");
        recovery = _recovery;

        emit ChangeRecovery(recovery);
        return true;
    }
    
    function commit_transfer_ownership(address _future_admin)external returns(bool){
        /***
        *@notice Commit a transfer of ownership.
        *@dev Must be accept by the future_owner via `accept_transfer_ownership`
        *@param _future_admin new admin address
        *@return bool success
        */
        require(address(msg.sender) == admin, "dev: admin only");
        future_admin = _future_admin;

        emit CommitAdmin(future_admin);
        return true;
    }

    function accept_transfer_ownership()external returns(bool){
        /***
        *@notice Accept a transfer of ownership
        *@return bool success
        */
        require(address(msg.sender) == future_admin, "dev: future_admin only");

        admin = future_admin;

        emit AcceptAdmin(admin);
        return true;
    }

}
