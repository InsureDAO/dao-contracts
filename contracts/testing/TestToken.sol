pragma solidity 0.8.10;
//SPDX-License-Identifier: MIT

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";

contract TestToken is IERC20 {
    using SafeMath for uint256;

    string public name;
    string public symbol;
    uint256 public _decimals;
    mapping(address => uint256) public override balanceOf;
    mapping(address => mapping(address => uint256)) public allowances;
    uint256 public total_supply;

    constructor(
        string memory _name,
        string memory _symbol,
        uint256 _decimal
    ) {
        name = _name;
        symbol = _symbol;
        _decimals = _decimal;
    }

    function totalSupply() external view override returns (uint256) {
        return total_supply;
    }

    function decimals() public view returns (uint256) {
        return _decimals;
    }

    function allowance(address _owner, address _spender)
        external
        view
        override
        returns (uint256)
    {
        /***
         *@notice Check the amount of tokens that an owner allowed to a spender
         *@param _owner The address which owns the funds
         *@param _spender The address which will spend the funds
         *@return uint256 specifying the amount of tokens still available for the spender
         */
        return allowances[_owner][_spender];
    }

    function transfer(address _to, uint256 _value)
        external
        override
        returns (bool)
    {
        /***
         *@notice Transfer `_value` tokens from `msg.sender` to `_to`
         *@dev Vyper does not allow underflows, so the subtraction in
         *     this function will revert on an insufficient balance
         *@param _to The address to transfer to
         *@param _value The amount to be transferred
         *@return bool success
         */
        require(_to != address(0)); // dev: transfers to 0x0 are not allowed
        balanceOf[msg.sender] = balanceOf[msg.sender].sub(_value);
        balanceOf[_to] = balanceOf[_to].add(_value);
        emit Transfer(msg.sender, _to, _value);
        return true;
    }

    function transferFrom(
        address _from,
        address _to,
        uint256 _value
    ) external override returns (bool) {
        /***
         * @notice Transfer `_value` tokens from `_from` to `_to`
         * @param _from address The address which you want to send tokens from
         * @param _to address The address which you want to transfer to
         * @param _value uint256 the amount of tokens to be transferred
         * @return bool success
         */
        require(_from != address(0), "ERC20: transfer from the zero address");
        require(_to != address(0), "ERC20: transfer to the zero address"); // dev: transfers to 0x0 are not allowed
        require(
            allowances[_from][msg.sender] >= _value,
            "dev: allowance not enough"
        );
        // NOTE: vyper does not allow underflows
        //       so the following subtraction would revert on insufficient balance
        balanceOf[_from] = balanceOf[_from].sub(_value);
        balanceOf[_to] = balanceOf[_to].add(_value);
        allowances[_from][msg.sender] = allowances[_from][msg.sender].sub(
            _value
        );
        emit Transfer(_from, _to, _value);
        return true;
    }

    function approve(address _spender, uint256 _value)
        external
        override
        returns (bool)
    {
        allowances[msg.sender][_spender] = _value;

        emit Approval(msg.sender, _spender, _value);
        return true;
    }

    function _mint_for_testing(uint256 _value) external {
        total_supply = total_supply.add(_value);
        balanceOf[msg.sender] = balanceOf[msg.sender].add(_value);

        emit Transfer(address(0), msg.sender, _value);
    }

    function _burn(address _to, uint256 _value) internal {
        require(_to != address(0));

        total_supply = total_supply.sub(_value);
        balanceOf[_to] = balanceOf[_to].sub(_value);
        emit Transfer(_to, address(0), _value);
    }

    function burn(uint256 _value) external returns (bool) {
        _burn(msg.sender, _value);
        return true;
    }
}
