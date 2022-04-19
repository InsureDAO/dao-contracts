pragma solidity 0.8.10;
//SPDX-License-Identifier: MIT

import "@openzeppelin/contracts/utils/math/Math.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";

contract TestLP {
    using SafeMath for uint256;

    string public name;
    string public symbol;
    uint256 public _decimals;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) allowances;
    uint256 public total_supply;
    address public minter;

    event Transfer(address indexed _from, address indexed _to, uint256 _value);
    event Approval(
        address indexed _owner,
        address indexed _spender,
        uint256 _value
    );

    constructor(
        string memory _name,
        string memory _symbol,
        uint256 _decimal,
        uint256 _supply
    ) {
        uint256 init_supply = _supply.mul(10**_decimals);
        name = _name;
        symbol = _symbol;
        _decimals = _decimal;
        balanceOf[msg.sender] = init_supply;
        total_supply = init_supply;
        minter = msg.sender;

        emit Transfer(address(0), msg.sender, init_supply);
    }

    function set_minter(address _minter) external {
        assert(msg.sender == minter);
        minter = _minter;
    }

    function totalSupply() external view returns (uint256) {
        return total_supply;
    }

    function allowance(address _owner, address _spender)
        external
        view
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

    function transfer(address _to, uint256 _value) external returns (bool) {
        /***
         *@notice Transfer `_value` tokens from `msg.sender` to `_to`
         *@dev Vyper does not allow underflows, so the subtraction in
         *     this function will revert on an insufficient balance
         *@param _to The address to transfer to
         *@param _value The amount to be transferred
         *@return bool success
         */
        assert(_to != address(0)); // dev: transfers to 0x0 are not allowed
        balanceOf[msg.sender] = balanceOf[msg.sender].sub(_value);
        balanceOf[_to] = balanceOf[_to].add(_value);
        emit Transfer(msg.sender, _to, _value);
        return true;
    }

    function transferFrom(
        address _from,
        address _to,
        uint256 _value
    ) external returns (bool) {
        /***
         * @notice Transfer `_value` tokens from `_from` to `_to`
         * @param _from address The address which you want to send tokens from
         * @param _to address The address which you want to transfer to
         * @param _value uint256 the amount of tokens to be transferred
         * @return bool success
         */
        require(_from != address(0), "ERC20: transfer from the zero address");
        require(_to != address(0), "ERC20: transfer to the zero address"); // dev: transfers to 0x0 are not allowed
        // NOTE: vyper does not allow underflows
        //       so the following subtraction would revert on insufficient balance
        balanceOf[_from] = balanceOf[_from].sub(_value);
        balanceOf[_to] = balanceOf[_to].add(_value);
        if (msg.sender != minter) {
            allowances[_from][msg.sender] = allowances[_from][msg.sender].sub(
                _value
            );
        }
        emit Transfer(_from, _to, _value);
        return true;
    }

    function approve(address _spender, uint256 _value) external returns (bool) {
        allowances[msg.sender][_spender] = _value;

        emit Approval(msg.sender, _spender, _value);
        return true;
    }

    function mint(address _to, uint256 _value) external {
        assert(msg.sender == minter);
        assert(_to != address(0));

        total_supply = total_supply.add(_value);
        balanceOf[_to] = balanceOf[_to].add(_value);
        emit Transfer(address(0), _to, _value);
    }

    function _burn(address _to, uint256 _value) internal {
        assert(_to != address(0));

        total_supply = total_supply.sub(_value);
        balanceOf[_to] = balanceOf[_to].sub(_value);
        emit Transfer(_to, address(0), _value);
    }

    function burn(uint256 _value) external {
        require(msg.sender == minter, "Only minter is allowed to burn");
        _burn(msg.sender, _value);
    }

    function burnFrom(address _to, uint256 _value) external {
        require(msg.sender == minter, "Only minter is allowed to burn");
        _burn(_to, _value);
    }
}
