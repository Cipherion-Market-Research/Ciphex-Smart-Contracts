// SPDX-License-Identifier: MIT
pragma solidity =0.8.27;

interface ICiphexContributionsStaking {
    struct StakeData {
        address staker;
        uint256 stakeAmount;
        uint256 withdrawedAmount;
        uint32 stakeTimestamp;
        uint16 lastWithdrawMonth;
    }

    error ZeroAddress();
    error ZeroValue();
    error AccessDenied();
    error InvalidVestingRate();
    error InvalidStakeId();
    error NotStakeOwner();
    error NotEnoughAvailableTokens();
    error LenghMistmatch();

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

    function setVestingRates(uint256[] calldata _vestingRates) external view;
    function stake(address _recipient, uint256 _amount) external;
    function unstake(uint256 _stakeId, uint256 _amount) external;
}
