pragma solidity 0.8.10;

/***
 *@title InsureToken
 *@author InsureDAO
 * SPDX-License-Identifier: MIT
 *@notice InsureDAO's governance token
 */

//libraries
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./interfaces/pool/IOwnership.sol";

contract InsureToken is IERC20 {
    event UpdateMiningParameters(
        uint256 time,
        uint256 rate,
        uint256 supply,
        int256 miningepoch
    );
    event SetMinter(address minter);
    event SetAdmin(address admin);
    event SetRate(uint256 rate);

    string public name;
    string public symbol;
    uint256 public constant decimals = 18;

    mapping(address => uint256) public override balanceOf;
    mapping(address => mapping(address => uint256)) allowances;
    uint256 public total_supply;

    address public minter;
    IOwnership public immutable ownership;

    //General constants
    uint256 constant YEAR = 86400 * 365;

    // Allocation within 5years:
    // ==========
    // * Team & Development: 24%
    // * Liquidity Mining: 40%
    // * Investors: 10%
    // * Foundation Treasury: 14%
    // * Community Treasury: 10%
    // ==========
    //
    // After 5years:
    // ==========
    // * Liquidity Mining: 40%~ (Mint fixed amount every year)
    //
    // Mint 2_800_000 INSURE every year.
    // 6th year: 1.32% inflation rate
    // 7th year: 1.30% inflation rate
    // 8th year: 1.28% infration rate
    // so on
    // ==========

    // Supply parameters
    uint256 constant INITIAL_SUPPLY = 126_000_000; //will be vested
    uint256 constant RATE_REDUCTION_TIME = YEAR;
    uint256[6] public RATES = [
        (28_000_000 * 10**18) / YEAR, //epoch 0
        (22_400_000 * 10**18) / YEAR, //epoch 1
        (16_800_000 * 10**18) / YEAR, //epoch 2
        (11_200_000 * 10**18) / YEAR, //epoch 3
        (5_600_000 * 10**18) / YEAR, //epoch 4
        (2_800_000 * 10**18) / YEAR //epoch 5~
    ];

    uint256 constant RATE_DENOMINATOR = 10**18;
    uint256 constant INFLATION_DELAY = 86400;

    // Supply variables
    int256 public mining_epoch;
    uint256 public start_epoch_time;
    uint256 public rate;

    uint256 public start_epoch_supply;

    uint256 public emergency_minted;

    modifier onlyOwner() {
        require(
            ownership.owner() == msg.sender,
            "Caller is not allowed to operate"
        );
        _;
    }

    /***
     * @notice Contract constructor
     * @param _name Token full name
     * @param _symbol Token symbol
     */
    constructor(
        string memory _name,
        string memory _symbol,
        address _ownership
    ) {
        uint256 _init_supply = INITIAL_SUPPLY * RATE_DENOMINATOR;
        name = _name;
        symbol = _symbol;
        balanceOf[msg.sender] = _init_supply;
        total_supply = _init_supply;
        ownership = IOwnership(_ownership);
        emit Transfer(address(0), msg.sender, _init_supply);

        unchecked {
            start_epoch_time =
                block.timestamp +
                INFLATION_DELAY -
                RATE_REDUCTION_TIME;
            mining_epoch = -1;
        }
        rate = 0;
        start_epoch_supply = _init_supply;
    }

    /***
     *@dev Update mining rate and supply at the start of the epoch
     *     Any modifying mining call must also call this
     */
    function _update_mining_parameters() internal {
        uint256 _rate = rate;
        uint256 _start_epoch_supply = start_epoch_supply;

        start_epoch_time += RATE_REDUCTION_TIME;
        unchecked {
            mining_epoch += 1;
        }

        if (mining_epoch == 0) {
            _rate = RATES[uint256(mining_epoch)];
        } else if (mining_epoch < int256(6)) {
            _start_epoch_supply += RATES[uint256(mining_epoch) - 1] * YEAR;
            start_epoch_supply = _start_epoch_supply;
            _rate = RATES[uint256(mining_epoch)];
        } else {
            _start_epoch_supply += RATES[5] * YEAR;
            start_epoch_supply = _start_epoch_supply;
            _rate = RATES[5];
        }
        rate = _rate;
        emit UpdateMiningParameters(
            block.timestamp,
            _rate,
            _start_epoch_supply,
            mining_epoch
        );
    }

    /***
     * @notice Update mining rate and supply at the start of the epoch
     * @dev Callable by any address, but only once per epoch
     *     Total supply becomes slightly larger if this function is called late
     */
    function update_mining_parameters() external {
        require(
            block.timestamp >= start_epoch_time + RATE_REDUCTION_TIME,
            "dev: too soon!"
        );
        _update_mining_parameters();
    }

    /***
     *@notice Get timestamp of the current mining epoch start
     *        while simultaneously updating mining parameters
     *@return Timestamp of the epoch
     */
    function start_epoch_time_write() external returns (uint256) {
        uint256 _start_epoch_time = start_epoch_time;
        if (block.timestamp >= _start_epoch_time + RATE_REDUCTION_TIME) {
            _update_mining_parameters();
            return start_epoch_time;
        } else {
            return _start_epoch_time;
        }
    }

    /***
     *@notice Get timestamp of the next mining epoch start
     *        while simultaneously updating mining parameters
     *@return Timestamp of the next epoch
     */
    function future_epoch_time_write() external returns (uint256) {
        uint256 _start_epoch_time = start_epoch_time;
        if (block.timestamp >= _start_epoch_time + RATE_REDUCTION_TIME) {
            _update_mining_parameters();
            return start_epoch_time + RATE_REDUCTION_TIME;
        } else {
            return _start_epoch_time + RATE_REDUCTION_TIME;
        }
    }

    function _available_supply() internal view returns (uint256) {
        return
            start_epoch_supply +
            ((block.timestamp - start_epoch_time) * rate) +
            emergency_minted;
    }

    /***
     *@notice Current number of tokens in existence (claimed or unclaimed)
     */
    function available_supply() external view returns (uint256) {
        return _available_supply();
    }

    /***
     *@notice How much supply is mintable from start timestamp till end timestamp
     *@param start Start of the time interval (timestamp)
     *@param end End of the time interval (timestamp)
     *@return Tokens mintable from `start` till `end`
     */
    function mintable_in_timeframe(uint256 start, uint256 end)
        external
        view
        returns (uint256)
    {
        require(start <= end, "dev: start > end");
        uint256 _to_mint = 0;

        uint256 _current_epoch_time = start_epoch_time;
        uint256 _current_rate = rate;
        int256 _current_epoch = mining_epoch;

        // Special case if end is in future (not yet minted) epoch
        if (end > _current_epoch_time + RATE_REDUCTION_TIME) {
            _current_epoch_time += RATE_REDUCTION_TIME;
            if (_current_epoch < 5) {
                _current_epoch += 1;
                _current_rate = RATES[uint256(_current_epoch)];
            } else {
                _current_epoch += 1;
                _current_rate = RATES[5];
            }
        }

        require(
            end <= _current_epoch_time + RATE_REDUCTION_TIME,
            "dev: too far in future"
        );

        for (uint256 i; i < 999; ) {
            // InsureDAO will not work in 1000 years.
            if (end >= _current_epoch_time) {
                uint256 current_end = end;
                if (current_end > _current_epoch_time + RATE_REDUCTION_TIME) {
                    current_end = _current_epoch_time + RATE_REDUCTION_TIME;
                }
                uint256 current_start = start;
                if (
                    current_start >= _current_epoch_time + RATE_REDUCTION_TIME
                ) {
                    break; // We should never get here but what if...
                } else if (current_start < _current_epoch_time) {
                    current_start = _current_epoch_time;
                }
                _to_mint += (_current_rate * (current_end - current_start));

                if (start >= _current_epoch_time) {
                    break;
                }
            }

            _current_epoch_time -= RATE_REDUCTION_TIME;

            if (_current_epoch == 0) {
                _current_rate = 0;
            } else {
                _current_rate = _current_epoch < 5
                    ? RATES[uint256(_current_epoch) - 1]
                    : RATES[5];
            }

            _current_epoch -= 1;

            assert(_current_rate <= RATES[0]); // This should never happen
            unchecked {
                ++i;
            }
        }
        return _to_mint;
    }

    /***
     *@notice Total number of tokens in existence.
     */
    function totalSupply() external view override returns (uint256) {
        return total_supply;
    }

    /***
     *@notice Check the amount of tokens that an owner allowed to a spender
     *@param _owner The address which owns the funds
     *@param _spender The address which will spend the funds
     *@return uint256 specifying the amount of tokens still available for the spender
     */
    function allowance(address _owner, address _spender)
        external
        view
        override
        returns (uint256)
    {
        return allowances[_owner][_spender];
    }

    /***
     *@notice Transfer `_value` tokens from `msg.sender` to `_to`
     *@dev Vyper does not allow underflows, so the subtraction in
     *     this function will revert on an insufficient balance
     *@param _to The address to transfer to
     *@param _value The amount to be transferred
     *@return bool success
     */
    function transfer(address _to, uint256 _value)
        external
        override
        returns (bool)
    {
        require(_to != address(0), "transfers to 0x0 are not allowed");
        uint256 _fromBalance = balanceOf[msg.sender];
        require(_fromBalance >= _value, "transfer amount exceeds balance");
        unchecked {
            balanceOf[msg.sender] = _fromBalance - _value;
        }
        balanceOf[_to] += _value;
        emit Transfer(msg.sender, _to, _value);
        return true;
    }

    /***
     * @notice Transfer `_value` tokens from `_from` to `_to`
     * @param _from address The address which you want to send tokens from
     * @param _to address The address which you want to transfer to
     * @param _value uint256 the amount of tokens to be transferred
     * @return bool success
     */
    function transferFrom(
        address _from,
        address _to,
        uint256 _value
    ) external override returns (bool) {
        require(_from != address(0), "transfer from the zero address");
        require(_to != address(0), "transfer to the zero address");

        uint256 currentAllowance = allowances[_from][msg.sender];
        require(currentAllowance >= _value, "transfer amount exceeds allow");
        unchecked {
            allowances[_from][msg.sender] -= _value;
        }

        uint256 _fromBalance = balanceOf[_from];
        require(_fromBalance >= _value, "transfer amount exceeds balance");
        unchecked {
            balanceOf[_from] -= _value;
        }
        balanceOf[_to] += _value;
        emit Transfer(_from, _to, _value);
        return true;
    }

    function _approve(
        address owner,
        address spender,
        uint256 amount
    ) internal {
        require(owner != address(0), "approve from the zero address");
        require(spender != address(0), "approve to the zero address");

        allowances[owner][spender] = amount;
        emit Approval(owner, spender, amount);
    }

    /**
     *@notice Approve `_spender` to transfer `_value` tokens on behalf of `msg.sender`
     *@param _spender The address which will spend the funds
     *@param _value The amount of tokens to be spent
     *@return bool success
     */
    function approve(address _spender, uint256 _value)
        external
        override
        returns (bool)
    {
        _approve(msg.sender, _spender, _value);
        return true;
    }

    function increaseAllowance(address _spender, uint256 addedValue)
        external
        returns (bool)
    {
        _approve(
            msg.sender,
            _spender,
            allowances[msg.sender][_spender] + addedValue
        );

        return true;
    }

    function decreaseAllowance(address _spender, uint256 subtractedValue)
        external
        returns (bool)
    {
        uint256 currentAllowance = allowances[msg.sender][_spender];
        require(
            currentAllowance >= subtractedValue,
            "decreased allowance below zero"
        );
        unchecked {
            _approve(msg.sender, _spender, currentAllowance - subtractedValue);
        }

        return true;
    }

    /***
     *@notice Mint `_value` tokens and assign them to `_to`
     *@dev Emits a Transfer event originating from 0x00
     *@param _to The account that will receive the created tokens
     *@param _value The amount that will be created
     *@return bool success
     */
    function mint(address _to, uint256 _value) external returns (bool) {
        require(msg.sender == minter, "dev: minter only");
        require(_to != address(0), "dev: zero address");

        _mint(_to, _value);

        return true;
    }

    function _mint(address _to, uint256 _value) internal {
        uint256 _total_supply = total_supply + _value;

        require(
            _total_supply <= _available_supply(),
            "exceeds allowable mint amount"
        );
        if (block.timestamp >= start_epoch_time + RATE_REDUCTION_TIME) {
            _update_mining_parameters();
        }
        total_supply = _total_supply;

        balanceOf[_to] += _value;
        emit Transfer(address(0), _to, _value);
    }

    /**
     *@notice Burn `_value` tokens belonging to `msg.sender`
     *@dev Emits a Transfer event with a destination of 0x00
     *@param _value The amount that will be burned
     *@return bool success
     */
    function burn(uint256 _value) external returns (bool) {
        require(
            balanceOf[msg.sender] >= _value,
            "_value > balanceOf[msg.sender]"
        );

        unchecked {
            balanceOf[msg.sender] -= _value;
        }
        total_supply -= _value;

        emit Transfer(msg.sender, address(0), _value);
        return true;
    }

    /***
     *@notice Change the token name and symbol to `_name` and `_symbol`
     *@dev Only callable by the admin account
     *@param _name New token name
     *@param _symbol New token symbol
     */
    function set_name(string memory _name, string memory _symbol)
        external
        onlyOwner
    {
        name = _name;
        symbol = _symbol;
    }

    /***
     *@notice Set the minter address
     *@dev Only callable once, when minter has not yet been set
     *@param _minter Address of the minter
     */
    function set_minter(address _minter) external onlyOwner {
        require(minter == address(0), "can set the minter at creation");
        minter = _minter;
        emit SetMinter(_minter);
    }

    /***
     *@notice Set the new rate for the infration after 5 years.
     *@dev input must be the number of INSURE to be minted per second.
     *@param _rate mint amount per second
     */
    function set_rate(uint256 _rate) external onlyOwner {
        require(_rate < RATES[5], "Decrease Only");

        RATES[5] = _rate;

        emit SetRate(_rate);
    }

    /***
     * @notice Emergency minting only when CDS couldn't afford the insolvency.
     * @dev
     * @param _amountOut token amount needed. token is defiend whithin converter.
     * @param _to CDS address
     */
    function emergency_mint(uint256 _amount, address _to)
        external
        returns (bool)
    {
        require(msg.sender == minter, "dev: minter only");
        //mint
        emergency_minted += _amount;
        _mint(_to, _amount);

        return true;
    }
}
