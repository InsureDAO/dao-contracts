pragma solidity ^0.6.0;
//SPDX-License-Identifier: MIT
/***
* Distribute part of admin fee to Reporting members;
* Distribute all amount in the contract whenever distribute() is smashed;
* 
*/

import "../libraries/token/ERC20/IERC20.sol";

import "../libraries/math/Math.sol";
import "../libraries/math/SafeMath.sol";
import "../libraries/utils/ReentrancyGuard.sol";

contract ReportingDistribution is ReentrancyGuard{
    using SafeMath for uint256;

    event Distribution(uint256 amount, uint256 blocktime);
    event CommitRecovery(address recovery);
    event ApplyRecovery(address recovery);
    event CommitAdmin(address admin);
    event AcceptAdmin(address admin);

    address public insure_reporting; //SURERPT address
    address public token; //token to be distributed;

    address public admin; //upgradable
    address public future_admin; 
    address public recovery; //upgradable
    address public future_recovery;
    bool public is_killed;
    
    mapping(uint256 => address) reporters; //ID => address
    uint256 reporters_length;
    mapping(address => uint256) claimable_fee;
    mapping(address => bool) is_kicked;

    constructor(
        address _insure_reporting,
        address _token,
        address _recovery,
        address _admin
    )public{
        /***
        *@notice Contract constructor
        *@param _insure_reporting InsureReportingToken conntract address(ReportingDAO)
        *@param _token Fee token address (DAI)
        *@param _recovery Address to transfer `_token` balance to if this contract is killed
        *@param _admin Admin address
        */

        insure_reporting = _insure_reporting;
        token = _token;
        recovery = _recovery;
        admin = _admin;
    }


    function distribute(address _coin)external returns(bool){
        /***
        * @notice Recieve DAI into the contract and trigger a token checkpoint
        * @param _coin address of the coin being received (must be DAI)
        * @return bool success
        */
        //
        require(_coin == token);
        require(!is_killed, "dev: contract is killed");
        uint256 total_amount = IERC20(_coin).allowance(msg.sender, address(this)); //Amount of token PoolProxy allows me
        if(total_amount != 0){
            IERC20(_coin).transferFrom(msg.sender, address(this), total_amount); //allowance will be 0
            uint256 _rpt_supply = IERC20(insure_reporting).totalSupply();
            for(uint256 i=0; i < reporters_length; i++){
                address _addr = reporters[i];
                if(_addr != address(0) && is_kicked[_addr] == false){
                    uint256 _rpt_balance = IERC20(insure_reporting).balanceOf(_addr);
                    uint256 _amount = total_amount.mul(_rpt_balance).div(_rpt_supply);
                    claimable_fee[_addr] = claimable_fee[_addr].add(_amount);
                }
            }
        }
        emit Distribution(total_amount, block.timestamp);
    }

    function _claim(address _addr)internal returns(uint256){
        require(is_kicked[_addr] != true);
        require(claimable_fee[_addr] != 0, "dev: no claimable fee");

        uint256 amount = claimable_fee[_addr];
        claimable_fee[_addr] = 0;
        require(IERC20(token).transfer(_addr, amount));
        return amount;
    }

    function claim(address _addr)external returns(uint256){
        /***
        *@notice Claim fees for _addr
        *@param _addr Address to claim fees for
        *@return 
        */
        require(is_killed != true, "dev: contract is killed");
        uint256 amount = _claim(_addr);

        return amount;
    }

    function claim_many(address[20] memory _addrs)external returns(bool){
        require(is_killed != true, "dev: contract is killed");
        for(uint256 i = 0; i<20; i++){
            if(_addrs[i] == address(0)){
                break;
            }
            _claim(_addrs[i]);
        }

        return true;
    }

    function _update_reporter(address _addr)internal nonReentrant returns(bool){
        /***
        * @notice register or kick the reporter depends on whether he has SURERPT or not.
        * @param _addr address to be updated
        * @return bool success
        */
        
        if(IERC20(insure_reporting).balanceOf(_addr) == 0){
            //kick the reporter
            if(claimable_fee[_addr] != 0){
                uint256 amount = claimable_fee[_addr];
                claimable_fee[_addr] = 0;
                IERC20(token).transferFrom(address(this), _addr, amount);
            }
            is_kicked[_addr] = true;
            return true;
        }else{
            //register the address
            reporters_length = reporters_length.add(1);
            reporters[reporters_length] = _addr;
            return true;
        }
    }

    function update_reporter(address _addr)external {
        require(is_killed != true, "dev: contract is killed");
        _update_reporter(_addr);
    }

    function update_reporters(address[20] memory _addrs)external {
        require(is_killed != true, "dev: contract is killed");
        for(uint256 i = 0; i<20; i++){
            if(_addrs[i] == address(0)){
                break;
            }

            _update_reporter(_addrs[i]);
        }
    }

    function kill_me()external{
        /***
        *@notice Kill the contract
        *@dev Killing transfers the entire DAI balance to the recovery address
        * and blocks the ability to claim or burn. The contract cannot be unkilled.
        */
        require(msg.sender == admin, "dev: admin only");
        is_killed == true;

        uint256 amount = IERC20(token).balanceOf(address(this));
        IERC20(token).transfer(recovery, amount);
    }


    function recover_balance(address _coin)external returns(bool){
        /***
        *@notice Recover ERC20 tokens from this contract
        *@dev Tokens are sent to the recovery address.
        *@param _coin Token address
        *@return bool success
        */
        require(msg.sender == admin, "dev: admin only");
        require(_coin == token);

        uint256 amount = IERC20(token).balanceOf(address(this));
        IERC20(token).transfer(recovery, amount);

        return true;
    }

    function commit_transfer_recovery(address _recovery)external returns(bool){
        /***
        *@notice Commit a transfer of recovery address.
        *@dev Must be apply by the owner via `apply_transfer_recovery`
        *@param _recovery new recovery address
        *@return bool success
        */

        require(msg.sender == admin, "dev: admin only");
        future_recovery = _recovery;

        emit CommitRecovery(future_recovery);
    }

    function apply_transfer_recovery()external returns(bool){
        /***
        *@notice Apply a transfer of recovery address.
        *@return bool success
        */
        require(msg.sender == admin, "dev: admin only");
        require(future_recovery != address(0));

        recovery = future_recovery;
        emit ApplyRecovery(recovery);
    }
    
    function commit_transfer_ownership(address _future_admin)external returns(bool){
        /***
        *@notice Commit a transfer of ownership.
        *@dev Must be accept by the future_owner via `accept_transfer_ownership`
        *@param _future_admin new admin address
        *@return bool success
        */
        require(msg.sender == admin, "dev: admin only");
        future_admin = _future_admin;

        emit CommitAdmin(future_admin);
    }

    function accept_transfer_ownership()external returns(bool){
        /***
        *@notice Accept a transfer of ownership
        *@return bool success
        */
        require(msg.sender == future_admin, "dev: future_admin only");

        admin = future_admin;

        emit AcceptAdmin(admin);
    }

}
