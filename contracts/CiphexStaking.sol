// SPDX-License-Identifier: MIT
pragma solidity =0.8.27;
import "@openzeppelin/contracts-upgradeable/access/Ownable2StepUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./interfaces/ICiphexStaking.sol";

contract CiphexStaking is OwnableUpgradeable, ICiphexStaking {
    using SafeERC20 for IERC20;
    /// @notice Lock period of Ciphex tokens, which is equal to 180 days
    uint32 public constant LOCK_PERIOD = 0;
    /// @notice Vesting period of Ciphex tokens, which is equal to 1 year (360 days)
    uint32 public constant VESTING_PERIOD = 60 * 60 * 24 * 30 * 12;
    /// @notice Constant for increasing precision of calculations, also associated with 100% for vesting rates
    uint256 public constant MULTIPLIER = 1e18;
    /// @notice The 100% of reward index
    uint24 public constant REWARD_INDEX_100 = 1e6;
    /// @notice constant which describes 1 month, is used in vesting calculations
    uint32 public constant MONTH = 60 * 60 * 24 * 30;
    /// @notice address of Ciphex tokens
    address public ciphex;
    /// @notice address of Ciphex presale smart contract
    address public presale;
    /// @notice counter of stakes ids
    uint256 public stakeCounter;
    /// @notice describes amount of rewards which must be deposited to the contract as staking rewards
    uint256 public requiredRewards;
    /// @notice describes amount of Ciphex tokens which are reserved as rewards in the smart contract
    uint256 public rewardAmount;
    /// @notice describes amount of all Ciphex tokens which is staked in the smart contract
    uint256 public totalStakedAmount;
    /// @notice array of vesting rates, is used for vesting calculations
    uint256[12] public vestingRates;
    /// @notice mapping which stores all stakes which associates with specific addres
    /// @dev user address => stake ids array
    mapping(address => uint256[]) public userStakes;
    /// @notice mapping which stores information of each stake
    /// @dev staking id => stake data
    mapping(uint256 => StakeData) public stakes;
    /// @notice rewardIndex for reward calculations
    uint24 public rewardIndex;

    modifier onlyOwnerOrPesale() {
        if (_msgSender() != owner() && _msgSender() != presale) {
            revert AccessDenied();
        }
        _;
    }

    modifier onlyStakeOwner(uint256 _stakeId) {
        address staker = stakes[_stakeId].staker;
        if (staker == address(0)) {
            revert InvalidStakeId();
        }
        if (staker != _msgSender()) revert NotStakeOwner();
        _;
    }

    constructor() {
        _disableInitializers();
    }

    /**
     * @param _ciphex address of Ciphex tokens
     * @param _presale address of CiphexPresale smart contract
     * @param _rewardIndex reward index
     */
    function initialize(
        address _ciphex,
        address _presale,
        uint24 _rewardIndex
    ) external initializer {
        if (_ciphex == address(0) || _presale == address(0))
            revert ZeroAddress();
        if (_rewardIndex == 0 || _rewardIndex > REWARD_INDEX_100)
            revert InvalidRewardIndex();
        _rewardIndex = _rewardIndex;
        rewardIndex = _rewardIndex;
        ciphex = _ciphex;
        presale = _presale;
        stakeCounter = 1e6;
        __Ownable_init(_msgSender());
    }

    /**
     * @notice transfer sender's Ciphex tokens to the contract as staking rewards
     * @dev can be called only by owner
     * If passed amount is greater than requiredRewards, reverts with error RequiredRewardsUnderflow;
     * @param _amount address of Ciphex tokens to deposit as rewards
     */
    function depositRewards(uint256 _amount) external onlyOwner {
        if (_amount == 0) revert ZeroValue();
        if (_amount > requiredRewards) revert RequiredRewardsUnderflow();
        IERC20(ciphex).safeTransferFrom(_msgSender(), address(this), _amount);
        requiredRewards -= _amount;
        rewardAmount += _amount;
        emit RewardsDeposited(_amount);
    }

    /**
     * @dev can be called only be owner;
     * each element describes vesting rate for specific month (1 - 12) of Vesting period
     * Restrictions for vesting rates:
     * - array length must be equal 12
     * - each element must be in range: 0 < vestingRate <= MULTIPLIER(100%)
     * - last element must be equal MULTIPLIER(100%)
     * @param _vestingRates array of vesting rates
     */
    function setVestingRates(
        uint256[] calldata _vestingRates
    ) external onlyOwner {
        _setVestingRates(_vestingRates);
    }

    /**
     * @notice stake passed amount of Ciphex tokens to passed address
     * @dev only owner or CiphexPresale smart contract can call the function
     * @param _recipient address of Ciphex tokens recipient and stake owner, can't be equal to zero address
     * @param _amount amount of Ciphex tokens to stake
     */
    function stake(
        address _recipient,
        uint256 _amount
    ) external onlyOwnerOrPesale {
        _stake(_recipient, _amount);
    }

    /**
     * @notice stake passed amountes of Ciphex tokens to passed addresses
     * @dev only owner can call the function
     * @param _recipients array of addresses of Ciphex tokens recipients
     * @param _amounts  array of amounts of Ciphex tokens to stake
     */
    function stake(
        address[] calldata _recipients,
        uint256[] calldata _amounts
    ) external onlyOwner {
        if (_recipients.length != _amounts.length) revert LenghMistmatch();
        for (uint256 i; i < _recipients.length; ++i) {
            _stake(_recipients[i], _amounts[i]);
        }
    }

    /**
     * @notice withdraw staked Ciphex tokens
     * @dev only owner of passed stake can call the function
     * if stake doesn't exist - reverts
     * @param _stakeId if of stake
     * @param _amount amount of Ciphex tokens to withdraw
     */
    function unstake(
        uint256 _stakeId,
        uint256 _amount
    ) external onlyStakeOwner(_stakeId) {
        _unstake(_stakeId, _amount);
    }

    /**
     * @notice withdraw staked Ciphex tokens from multiple stakes
     * @dev only owner of passed stakes can call the function
     * if stake doesn't exist or sender isn't owner - reverts
     * @param _stakeIds array of stake ids
     * @param _amounts array of amounts of Ciphex tokens to withdraw
     */
    function unstakes(
        uint256[] calldata _stakeIds,
        uint256[] calldata _amounts
    ) external {
        if (_stakeIds.length != _amounts.length) revert LenghMistmatch();
        for (uint256 i; i < _stakeIds.length; ++i) {
            address staker = stakes[_stakeIds[i]].staker;
            if (staker == address(0)) {
                revert InvalidStakeId();
            }
            if (staker != _msgSender()) revert NotStakeOwner();
            _unstake(_stakeIds[i], _amounts[i]);
        }
    }

    /**
     * @notice withdraw rewards for staking
     * @dev only owner of passed stake can call the function
     * if stake doesn't exist - reverts
     * @param _stakeId if of stake
     */
    function claimRewards(uint256 _stakeId) public onlyStakeOwner(_stakeId) {
        StakeData memory localStake = stakes[_stakeId];
        if (block.timestamp < (localStake.stakeTimestamp + LOCK_PERIOD))
            revert RewardsAreLocked();
        uint256 earned = localStake.earnedRewards;
        if (earned == 0) revert ZeroValue();
        stakes[_stakeId].earnedRewards = 0;
        rewardAmount -= earned;
        IERC20(ciphex).safeTransfer(_msgSender(), earned);
        emit RewardsClaimed(_stakeId, _msgSender(), earned);
    }

    function claimRewards(uint256[] calldata _stakeIds) public {
        for (uint256 i; i < _stakeIds.length; ++i) {
            address staker = stakes[_stakeIds[i]].staker;
            if (staker == address(0)) {
                revert InvalidStakeId();
            }
            if (staker != _msgSender()) revert NotStakeOwner();
            claimRewards(_stakeIds[i]);
        }
    }

    /**
     * @notice returns stake ids owned by passed user address
     * @param _user address of staker
     */
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

    /**
     * @notice returns withdrawable amount of passed stake
     * @param _stakeId stake id
     */
    function getWithdrawableAmount(
        uint256 _stakeId
    ) public view returns (uint256) {
        return _calculateWithdrawableAmount(_stakeId);
    }

    function _stake(address _recipient, uint256 _amount) internal {
        if (_amount == 0) revert ZeroValue();
        if (_recipient == address(0)) revert ZeroAddress();
        stakeCounter++;
        uint24 rewIndex = rewardIndex;
        uint256 stakeId = stakeCounter;
        uint256 earnedRewards = _calculateRewards(_amount, rewIndex);
        stakes[stakeId] = StakeData({
            staker: _recipient,
            stakeAmount: _amount,
            withdrawedAmount: 0,
            rewardIndex: rewIndex,
            earnedRewards: earnedRewards,
            stakeTimestamp: uint32(block.timestamp),
            lastWithdrawMonth: 0
        });
        userStakes[_recipient].push(stakeId);
        totalStakedAmount += _amount;
        requiredRewards += earnedRewards;
        IERC20(ciphex).safeTransferFrom(_msgSender(), address(this), _amount);
        emit StakeCreated(stakeId, _recipient, _amount);
    }

    function _calculateRewards(
        uint256 _stakedAmount,
        uint32 _rewardIndex
    ) internal pure returns (uint256) {
        return
            ((_stakedAmount * _rewardIndex * MULTIPLIER) / REWARD_INDEX_100) /
            MULTIPLIER;
    }

    function _setVestingRates(uint256[] calldata _vestingRates) internal {
        if (_vestingRates.length != 12) revert InvalidVestingRatesLengh();
        if (_vestingRates[_vestingRates.length - 1] != MULTIPLIER)
            revert InvalidVestingRate();
        for (uint256 i; i < _vestingRates.length; ++i) {
            if (_vestingRates[i] == 0) revert ZeroValue();
            if (MULTIPLIER < _vestingRates[i]) revert InvalidVestingRate();
            vestingRates[i] = _vestingRates[i];
        }
        emit VestingRatesUpdated(_vestingRates);
    }

    function _unstake(uint256 _stakeId, uint256 _amount) internal {
        uint256 withdrawableAmount = _calculateWithdrawableAmount(_stakeId);
        if (withdrawableAmount == 0 || withdrawableAmount < _amount)
            revert NotEnoughAvailableTokens();
        if (_amount == 0) _amount = withdrawableAmount;
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
        if (block.timestamp < data.stakeTimestamp + LOCK_PERIOD) return 0;
        if (
            block.timestamp >=
            data.stakeTimestamp + LOCK_PERIOD + VESTING_PERIOD
        ) return data.stakeAmount - data.withdrawedAmount;

        uint32 delta = uint32(block.timestamp) -
            (data.stakeTimestamp + LOCK_PERIOD);
        uint256 vestingMonth = (delta / MONTH) + 1;
        if (vestingMonth == data.lastWithdrawMonth) return 0;
        uint256 remainder = data.stakeAmount - data.withdrawedAmount;
        if (remainder == 0) return 0;
        // multiplying and dividing on MULTIPLIER to increase precision
        return
            ((remainder * vestingRates[vestingMonth - 1] * MULTIPLIER) /
                MULTIPLIER) / MULTIPLIER;
    }

    function _getCurrentVestingMonth(
        uint256 _stakeId
    ) internal view returns (uint16) {
        uint32 delta = uint32(block.timestamp) -
            (stakes[_stakeId].stakeTimestamp + LOCK_PERIOD);
        return uint16(delta / MONTH) + 1;
    }
}
