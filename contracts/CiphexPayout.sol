// SPDX-License-Identifier: MIT
pragma solidity =0.8.27;
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ICiphexPayout} from "./interfaces/ICiphexPayout.sol";

contract CiphexPayout is OwnableUpgradeable, ICiphexPayout {
    using SafeERC20 for IERC20;
    /// @notice address of CPX token
    address public ciphex;
    /// @notice address of USDT token
    address public usdt;

    constructor() {
        _disableInitializers();
    }

    /**
     * @param _ciphex address of Ciphex tokens
     * @param _usdt address of USDT token
     */
    function initialize(address _ciphex, address _usdt) external initializer {
        if (_ciphex == address(0) || _usdt == address(0)) revert ZeroAddress();
        ciphex = _ciphex;
        usdt = _usdt;
        __Ownable_init(_msgSender());
    }

    /**
     * @notice deposit passed amount of CPX and USDT tokens as affiliate reward for passed affiliate (_recipient)
     * @dev only owner can call the function
     * @param _recipient affiliate address
     * @param _cpxAmount amount of CPX tokens to deposit
     * @param _usdAmount amount of USDT tokens to deposit
     */
    function depositReward(
        address _recipient,
        uint256 _cpxAmount,
        uint256 _usdAmount
    ) external onlyOwner {
        _depositRewards(_recipient, _cpxAmount, _usdAmount);
    }

    /**
     * @notice stake passed amountes of CPX tokens to passed addresses
     * @dev only owner can call the function
     * @param _recipients array of addresses of affiliates
     * @param _cpxAmounts  array of amounts of CPX tokens to deposit
     * @param _usdAmounts  array of amounts of USDT tokens to deposit
     */
    function depositRewards(
        address[] calldata _recipients,
        uint256[] calldata _cpxAmounts,
        uint256[] calldata _usdAmounts
    ) external onlyOwner {
        if (
            _recipients.length != _cpxAmounts.length ||
            _recipients.length != _usdAmounts.length
        ) revert LenghMistmatch();
        for (uint256 i; i < _recipients.length; ++i) {
            _depositRewards(_recipients[i], _cpxAmounts[i], _usdAmounts[i]);
        }
    }

    function _depositRewards(
        address _recipient,
        uint256 _cpxAmount,
        uint256 _usdAmount
    ) internal {
        if (_cpxAmount == 0 || _usdAmount == 0) revert ZeroValue();
        if (_recipient == address(0)) revert ZeroAddress();
        IERC20(ciphex).safeTransferFrom(_msgSender(), _recipient, _cpxAmount);
        IERC20(usdt).safeTransferFrom(_msgSender(), _recipient, _usdAmount);
        emit RewardsDeposited(_recipient, _cpxAmount, _usdAmount);
    }
}
