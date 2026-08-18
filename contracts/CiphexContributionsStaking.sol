// SPDX-License-Identifier: MIT
pragma solidity =0.8.27;

import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ICiphexContributionsStaking} from "./interfaces/ICiphexContributionsStaking.sol";

/// @title CiphexContributionsStaking
/// @notice Upgradeable principal vesting for tiered contributions.
/// @dev Applies fixed cumulative releases at days 120, 150, and 180 without
///      exposing reward state or reward operations.
contract CiphexContributionsStaking is
    OwnableUpgradeable,
    ICiphexContributionsStaking
{
    using SafeERC20 for IERC20;

    uint32 public constant LOCK_PERIOD = 90 days;
    uint32 public constant VESTING_PERIOD = 90 days;
    uint256 public constant MULTIPLIER = 1e18;
    uint32 public constant MONTH = 30 days;
    uint256 public constant INITIAL_STAKE_COUNTER = 1_999_999_999;
    uint256 public constant VESTING_MONTHS = 3;
    uint256 public constant VESTING_UNIT = 0.01 ether;
    uint32 public constant FIRST_RELEASE = 120 days;
    uint32 public constant SECOND_RELEASE = 150 days;
    uint32 public constant FINAL_RELEASE = 180 days;

    address public ciphex;
    address public contributions;
    uint256 public stakeCounter;
    uint256 public totalStakedAmount;
    uint256[3] public vestingRates;
    mapping(address => uint256[]) public userStakes;
    mapping(uint256 => StakeData) public stakes;

    modifier onlyOwnerOrContribution() {
        if (_msgSender() != owner() && _msgSender() != contributions) {
            revert AccessDenied();
        }
        _;
    }

    modifier onlyStakeOwner(uint256 _stakeId) {
        address staker = stakes[_stakeId].staker;
        if (staker == address(0)) revert InvalidStakeId();
        if (staker != _msgSender()) revert NotStakeOwner();
        _;
    }

    constructor() {
        _disableInitializers();
    }

    function initialize(
        address _ciphex,
        address _contributions
    ) external initializer {
        if (_ciphex == address(0) || _contributions == address(0)) {
            revert ZeroAddress();
        }
        ciphex = _ciphex;
        contributions = _contributions;
        stakeCounter = INITIAL_STAKE_COUNTER;
        vestingRates[0] = MULTIPLIER / 3;
        vestingRates[1] = (MULTIPLIER * 2) / 3;
        vestingRates[2] = MULTIPLIER;
        __Ownable_init(_msgSender());
    }

    /// @dev Vesting terms are fixed for these contributions.
    function setVestingRates(uint256[] calldata) external view onlyOwner {
        revert InvalidVestingRate();
    }

    function stake(
        address _recipient,
        uint256 _amount
    ) external onlyOwnerOrContribution {
        _stake(_recipient, _amount);
    }

    function stake(
        address[] calldata _recipients,
        uint256[] calldata _amounts
    ) external onlyOwner {
        if (_recipients.length != _amounts.length) revert LenghMistmatch();
        for (uint256 i; i < _recipients.length; ++i) {
            _stake(_recipients[i], _amounts[i]);
        }
    }

    function unstake(
        uint256 _stakeId,
        uint256 _amount
    ) external onlyStakeOwner(_stakeId) {
        _unstake(_stakeId, _amount);
    }

    function unstakes(
        uint256[] calldata _stakeIds,
        uint256[] calldata _amounts
    ) external {
        if (_stakeIds.length != _amounts.length) revert LenghMistmatch();
        for (uint256 i; i < _stakeIds.length; ++i) {
            address staker = stakes[_stakeIds[i]].staker;
            if (staker == address(0)) revert InvalidStakeId();
            if (staker != _msgSender()) revert NotStakeOwner();
            _unstake(_stakeIds[i], _amounts[i]);
        }
    }

    function getUserStakes(
        address _user
    ) public view returns (uint256[] memory) {
        uint256 length = userStakes[_user].length;
        uint256[] memory array = new uint256[](length);
        for (uint256 i; i < length; ++i) {
            array[i] = userStakes[_user][i];
        }
        return array;
    }

    function getWithdrawableAmount(
        uint256 _stakeId
    ) public view returns (uint256) {
        return _calculateWithdrawableAmount(_stakeId);
    }

    function _stake(address _recipient, uint256 _amount) internal {
        if (_amount == 0) revert ZeroValue();
        if (_recipient == address(0)) revert ZeroAddress();

        stakeCounter++;
        uint256 stakeId = stakeCounter;
        stakes[stakeId] = StakeData({
            staker: _recipient,
            stakeAmount: _amount,
            withdrawedAmount: 0,
            stakeTimestamp: uint32(_now()),
            lastWithdrawMonth: 0
        });
        userStakes[_recipient].push(stakeId);
        totalStakedAmount += _amount;
        IERC20(ciphex).safeTransferFrom(_msgSender(), address(this), _amount);
        emit StakeCreated(stakeId, _recipient, _amount);
    }

    function _unstake(uint256 _stakeId, uint256 _amount) internal {
        uint256 withdrawableAmount = _calculateWithdrawableAmount(_stakeId);
        if (withdrawableAmount == 0) revert NotEnoughAvailableTokens();
        if (_amount == 0) {
            _amount = withdrawableAmount;
        } else if (_amount > withdrawableAmount) {
            revert NotEnoughAvailableTokens();
        }

        stakes[_stakeId].withdrawedAmount += _amount;
        stakes[_stakeId].lastWithdrawMonth = _getCurrentVestingMonth(_stakeId);
        totalStakedAmount -= _amount;
        IERC20(ciphex).safeTransfer(_msgSender(), _amount);
        emit Unstaked(_stakeId, _msgSender(), _amount);
    }

    function _calculateWithdrawableAmount(
        uint256 _stakeId
    ) internal view returns (uint256) {
        StakeData memory data = stakes[_stakeId];
        uint256 vestedAmount = _cumulativeVestedAmount(data);
        if (vestedAmount <= data.withdrawedAmount) return 0;
        return vestedAmount - data.withdrawedAmount;
    }

    function _cumulativeVestedAmount(
        StakeData memory _stakeData
    ) internal view returns (uint256) {
        uint256 elapsed = _now() - uint256(_stakeData.stakeTimestamp);
        if (elapsed < FIRST_RELEASE) return 0;
        if (elapsed < SECOND_RELEASE) {
            return _floorToVestingUnit(_stakeData.stakeAmount / 3);
        }
        if (elapsed < FINAL_RELEASE) {
            return _floorToVestingUnit((_stakeData.stakeAmount * 2) / 3);
        }
        return _stakeData.stakeAmount;
    }

    function _floorToVestingUnit(
        uint256 _amount
    ) internal pure returns (uint256) {
        return _amount - (_amount % VESTING_UNIT);
    }

    function _getCurrentVestingMonth(
        uint256 _stakeId
    ) internal view returns (uint16) {
        uint256 elapsed = _now() -
            uint256(stakes[_stakeId].stakeTimestamp);
        if (elapsed < FIRST_RELEASE) return 0;
        if (elapsed < SECOND_RELEASE) return 1;
        if (elapsed < FINAL_RELEASE) return 2;
        return uint16(VESTING_MONTHS);
    }

    function _now() internal view virtual returns (uint256) {
        return block.timestamp;
    }
}
