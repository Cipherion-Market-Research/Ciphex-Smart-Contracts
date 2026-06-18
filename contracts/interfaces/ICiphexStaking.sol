// SPDX-License-Identifier: MIT
pragma solidity =0.8.27;

interface ICiphexStaking {
    struct StakeData {
        address staker;
        uint256 stakeAmount;
        uint256 withdrawedAmount;
        uint256 rewardIndex;
        uint256 earnedRewards;
        uint32 stakeTimestamp;
        uint16 lastWithdrawMonth;
    }
    error ZeroAddress();
    error ZeroValue();
    error AccessDenied();
    error InvalidRewardIndex();
    error RewardsAreLocked();
    error UpdateCooldown();
    error InvalidVestingRatesLengh();
    error InvalidVestingRate();
    error InvalidStakeId();
    error NotStakeOwner();
    error NotEnoughAvailableTokens();
    error RequiredRewardsUnderflow();
    error LenghMistmatch();
    event RewardIndexUpdated(uint32 rewardIndex);
    event VestingRatesUpdated(uint256[] vestingRates);
    event ChainlinkUpdated(address chainlink);
    event StakeCreated(
        uint256 indexed stakeId,
        address indexed recipient,
        uint256 amount
    );
    event Unstaked(
        uint256 indexed stakeId,
        address indexed recipient,
        uint256 amount
    );
    event RewardsClaimed(
        uint256 indexed stakeId,
        address indexed recipient,
        uint256 rewardAmount
    );
    event RewardsDeposited(uint256 amount);
    function depositRewards(uint256 _amount) external;
    function setVestingRates(uint256[] calldata _vestingRates) external;
    function stake(address _recipient, uint256 _amount) external;
    function unstake(uint256 _stakeId, uint256 _amount) external;
    function claimRewards(uint256 _stakeId) external;
}
