// SPDX-License-Identifier: MIT
pragma solidity =0.8.27;
import "@openzeppelin/contracts-upgradeable/access/Ownable2StepUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./interfaces/ICiphexStaking.sol";
import "./interfaces/ICiphexPresale.sol";
import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";

contract CiphexPresale is
    Ownable2StepUpgradeable,
    ReentrancyGuardUpgradeable,
    ICiphexPresale
{
    using SafeERC20 for IERC20Metadata;
    /// @notice variable for increasing precision in calculations
    uint256 public constant PRECISION = 1 ether;
    /// @notice price multiplier for price calculation
    /// @dev price increases each 24h for the multiplier;
    /// Multiplier equals 0.89%
    uint256 public constant PRICE_MULTIPLIER = 89e14;
    /// @notice start price of Ciphex token equals 0.1$
    uint32 public constant START_PRICE = 1e5;
    /// @notice max price of Ciphex token equals 0.26$
    uint32 public constant MAX_PRICE = 26e4;
    /// @notice iterator for price calculation
    /// @dev price increases each 24h for price multiplier based on initial price
    uint32 public constant MULTIPLIER_ITERATION = 24 hours;
    uint256 public constant USD_DECIMALS = 6;
    uint256 public constant DAY = 86400;
    uint256 public constant MIN_TOKENS_TO_BUY = 2000e18;
    /// @notice address of Ciphex token
    address public ciphex;
    /// @notice amount of Ciphex token for presale
    uint256 public ciphexSupply;
    /// @notice timestamp of start presale period
    uint32 public presaleStart;
    /// @notice timestamp of end presale period
    uint32 public presaleEnd;
    /// @notice address of CiphexStaking smart contract
    address public staking;
    /// @notice address of USDC token address
    address public usdc;
    /// @notice address of USDT token address
    address public usdt;
    /// @notice stores total amount of raised funds in USD format
    /// @dev 1 USD = 1*10^6;
    /// is used for front-end purposes
    uint256 public raisedFunds;
    /// @notice mapping for status of USDC and USDT tokens
    /// @dev stable tokens => status
    /// if status equals true then users can fund the Presale SC with the token,
    /// else - can't
    mapping(address => bool) public tokenStatus;
    /// @notice address of ChainLink price feed between ETH and USD
    address public priceFeed;
    /// @notice mapping to store flags for calculation amount of uniq contributors
    mapping(address => bool) public isContributed;
    /// @notice amount of uniq contributors
    /// @dev is used for front-end purposes
    uint256 public contributorsAmount;

    constructor() {
        _disableInitializers();
    }

    /**
     * @param _usdc address of USDC token
     * @param _usdt address of USDT token
     * @param _priceFeed address of USD/ETH chainlink price feed smart contract
     */
    function initialize(
        address _usdc,
        address _usdt,
        address _priceFeed
    ) external initializer {
        if (
            _usdc == address(0) ||
            _usdt == address(0) ||
            _priceFeed == address(0)
        ) revert ZeroAddress();
        if (
            IERC20Metadata(_usdc).decimals() != USD_DECIMALS ||
            IERC20Metadata(_usdt).decimals() != USD_DECIMALS
        ) revert InvalidDecimals();
        usdc = _usdc;
        usdt = _usdt;
        tokenStatus[usdc] = true;
        tokenStatus[usdt] = true;
        priceFeed = _priceFeed;
        __Ownable_init(_msgSender());
        __ReentrancyGuard_init();
    }

    // ADMIN FUNCTIONS

    /**
     * @param _token address of USDC or USDT token
     * @param _status status of the stable tokens:
     * true - user can fund presale with the token;
     * false - user can't fund presale with the token;
     */
    function setStableStatus(address _token, bool _status) external onlyOwner {
        if (_token != usdc && _token != usdt) {
            revert InvalidTokenAddress();
        }
        tokenStatus[_token] = _status;
        emit StatusUpdated(_token, _status);
    }

    /**
     * @notice the function starts presale
     * @dev the function can be called only by owner
     * @param _ciphex address Ciphex token
     * @param _staking address of CiphexStaking smart contract
     * @param _ciphexAmount amount of Ciphex tokens for presale
     * @param _presaleDuration presale duration (180 days)
     */
    function startPresale(
        address _ciphex,
        address _staking,
        uint256 _ciphexAmount,
        uint32 _presaleDuration
    ) external onlyOwner {
        if (presaleStart != 0) revert PresaleAlreadyStarted();
        if (_ciphex == address(0) || _staking == address(0))
            revert ZeroAddress();
        if (_ciphexAmount == 0 || _presaleDuration == 0) revert ZeroValue();
        ciphex = _ciphex;
        staking = _staking;
        ciphexSupply = _ciphexAmount;
        presaleStart = uint32(block.timestamp);
        presaleEnd = uint32(block.timestamp + _presaleDuration);
        IERC20Metadata(_ciphex).safeTransferFrom(
            _msgSender(),
            address(this),
            _ciphexAmount
        );
        emit PresaleStarted(
            block.timestamp,
            block.timestamp + _presaleDuration,
            _ciphexAmount
        );
    }

    /**
     * @notice the function is used by owner to withdraw raised funds
     * @dev the function can be called only by owner
     * the length of passed arrays must be the same
     * the owner can't withdraw Ciphex tokens which are reserved for presale
     * exception if presale has ended and the contract has remainder of Ciphex tokens
     * @param _tokens arrays of tokens to withdraw (ETH - zero address, USDC, USDT)
     * @param _recipients arrays of tokens recipient
     * @param _values amount of tokens to transfer to recipient
     */
    function withdrawFunds(
        address[] calldata _tokens,
        address[] calldata _recipients,
        uint256[] calldata _values
    ) external onlyOwner {
        if (
            _tokens.length != _recipients.length ||
            _tokens.length != _values.length
        ) revert LenghMistmatch();
        for (uint256 i; i < _tokens.length; ++i) {
            if (_tokens[i] == address(0)) {
                _transferEthTo(payable(_recipients[i]), _values[i]);
            } else {
                if (_tokens[i] == ciphex && isPresaleActive()) {
                    uint256 balance = IERC20Metadata(ciphex).balanceOf(
                        address(this)
                    );
                    if (_values[i] > balance - ciphexSupply)
                        revert NotEnoughCiphex();
                }
                IERC20Metadata(_tokens[i]).safeTransfer(
                    _recipients[i],
                    _values[i]
                );
            }
        }
    }

    // USER

    /**
     * @notice the function is used by users to buy Ciphex tokens by using ETH, USDC or USDT tokens
     * @dev if user send eth and the amount of eth if greater than passed one or user passed adddress of USDC ro USDT
     * then the eth must be refunded;
     * if amount of available Ciphex tokens isn't enough,
     * then chossed token must be refunded based delta of expected and available Ciphex tokens;
     * the bought ciphex tokens automaticaly locked in CiphexStaking smart contract.
     * @param _token address of token which will be using for buy (ETH - zero address, USDC, USDT)
     * @param _amount amount of tokens to spend
     * @param _recipient address of recipient Ciphex tokens after unlock. Can't be equal Zero Address
     * @param _referral address of referral
     */
    function buy(
        address _token,
        uint256 _amount,
        address _recipient,
        address _referral
    ) external payable nonReentrant {
        if (_recipient == address(0)) revert ZeroAddress();
        if (_amount == 0) revert ZeroValue();
        if (_recipient == _referral) revert InvalidReferral();
        if (!isPresaleActive()) revert NotActivePresale();

        uint256 refundEth;
        uint256 tokensAmount;
        uint256 _raisedFunds;
        uint256 _ciphexSupply = ciphexSupply; // gas optimization
        if (_token == address(0)) {
            if (msg.value < _amount) revert NotEnoughEth();
            if (_amount < msg.value) refundEth = msg.value - _amount;
            tokensAmount = _convertEthToTokens(_amount);
            if (_ciphexSupply < tokensAmount) {
                uint256 delta = tokensAmount - _ciphexSupply;
                uint256 ethDelta = convertTokensToEth(delta);
                refundEth += ethDelta;
                _amount -= ethDelta;
                tokensAmount = _ciphexSupply;
            }
            _raisedFunds = _convertEthToUsd(_amount);
        } else {
            if (_token != usdc && _token != usdt) revert InvalidTokenAddress();
            if (!tokenStatus[_token]) revert InvalidTokenAddress();
            if (0 < msg.value) refundEth = msg.value;
            tokensAmount = _convertUsdToTokens(_amount);
            if (_ciphexSupply < tokensAmount) {
                uint256 delta = tokensAmount - _ciphexSupply;
                uint256 usdDelta = convertTokensToUsd(delta);
                _amount -= usdDelta;
                tokensAmount = _ciphexSupply;
            }
            _raisedFunds = _amount;
            IERC20Metadata(_token).safeTransferFrom(
                _msgSender(),
                address(this),
                _amount
            );
        }
        uint256 supplyAfterBuy = _ciphexSupply - tokensAmount;
        if (
            tokensAmount < MIN_TOKENS_TO_BUY ||
            (supplyAfterBuy < MIN_TOKENS_TO_BUY && supplyAfterBuy != 0)
        ) revert NotEnoughCiphex();
        address _staking = staking; // gas optimizations
        ciphexSupply -= tokensAmount;
        raisedFunds += _raisedFunds;
        if (!isContributed[_recipient]) {
            isContributed[_recipient] = true;
            contributorsAmount++;
        }
        IERC20Metadata(ciphex).safeIncreaseAllowance(_staking, tokensAmount);
        ICiphexStaking(_staking).stake(_recipient, tokensAmount);
        if (refundEth > 0) _transferEthTo(payable(_msgSender()), refundEth);
        emit Bought(
            _recipient,
            _referral,
            _token,
            _amount,
            tokensAmount,
            _getEthPrice(),
            getTokenPrice()
        );
    }

    // VIEW FUNCTIONS
    /**
     * @notice returns true if presale period is active, else - false
     */
    function isPresaleActive() public view returns (bool) {
        return
            ciphexSupply != 0 &&
            presaleStart != 0 &&
            block.timestamp < presaleEnd;
    }

    /**
     * @notice returns current Ciphex token price to USD, if presale isn't active - returns 0;
     */
    function getTokenPrice() public view returns (uint256) {
        if (!isPresaleActive()) return 0;
        uint256 deltaTime = block.timestamp - presaleStart;
        uint256 periods = deltaTime / MULTIPLIER_ITERATION;
        if (periods == 0) {
            return START_PRICE;
        } else {
            uint256 price = START_PRICE +
                ((START_PRICE * PRICE_MULTIPLIER * periods) / PRECISION);
            if (price > MAX_PRICE) return MAX_PRICE;
            return price;
        }
    }

    /**
     * @notice convert Ciphex to ETH based on current Ciphex token price
     */
    function convertTokensToEth(
        uint256 _amountOut
    ) public view returns (uint256) {
        if (_amountOut == 0 || !isPresaleActive()) return 0;
        return
            ((_amountOut * getTokenPrice() * PRECISION) / _getEthPrice()) /
            PRECISION;
    }

    /**
     * @notice convert Ciphex to USD based on current Ciphex token price
     */
    function convertTokensToUsd(
        uint256 _amountOut
    ) public view returns (uint256) {
        if (_amountOut == 0 || !isPresaleActive()) return 0;
        return (_amountOut * getTokenPrice()) / PRECISION;
    }

    /**
     * @notice convert ETH to Ciphex based on current Ciphex token price
     */
    function convertEthToTokens(
        uint256 _amountIn
    ) public view returns (uint256) {
        if (!isPresaleActive()) return 0;
        return _convertEthToTokens(_amountIn);
    }

    /**
     * @notice convert USD to Ciphex based on current Ciphex token price
     */
    function convertUsdToTokens(
        uint256 _amountIn
    ) public view returns (uint256) {
        if (!isPresaleActive()) return 0;
        return _convertUsdToTokens(_amountIn);
    }

    /**
     * @notice returns price of ETH to USD from chainlink price feed
     */
    function getEthPrice() public view returns (uint256) {
        return _getEthPrice();
    }

    // INTERNAL

    function _convertEthToUsd(uint256 _ethIn) internal view returns (uint256) {
        return (_ethIn * _getEthPrice()) / PRECISION;
    }

    function _transferEthTo(
        address payable _recipient,
        uint256 _amount
    ) internal {
        require(address(this).balance >= _amount, NotEnoughEth());
        (bool sent, ) = _recipient.call{value: _amount}("");
        require(sent, EthTransferError());
    }

    function _convertEthToTokens(
        uint256 _ethIn
    ) internal view returns (uint256) {
        if (_ethIn == 0) return 0;
        return
            ((_ethIn * _getEthPrice() * PRECISION) / getTokenPrice()) /
            PRECISION;
    }

    function _convertUsdToTokens(
        uint256 _usdIn
    ) internal view returns (uint256) {
        if (_usdIn == 0) return 0;
        return ((_usdIn * PRECISION * PRECISION) / getTokenPrice()) / PRECISION;
    }

    function _getEthPrice() internal view returns (uint256) {
        uint256 usdcDecimals = USD_DECIMALS;
        uint256 decimals = AggregatorV3Interface(priceFeed).decimals();
        (, int256 answer, , uint256 updatedAt, ) = AggregatorV3Interface(
            priceFeed
        ).latestRoundData();
        if ((block.timestamp - updatedAt) > DAY * 2)
            revert NotUpdatedPriceFeed();
        uint256 price = uint256(answer);
        // convert data to 6 decimal format
        if (decimals > usdcDecimals) {
            return uint256(price) / 10 ** (decimals - usdcDecimals);
        } else if (decimals < usdcDecimals) {
            return uint256(price) * (10 ** (usdcDecimals - decimals));
        } else {
            return price;
        }
    }
}
