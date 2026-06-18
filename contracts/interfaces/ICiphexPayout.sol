// SPDX-License-Identifier: MIT
pragma solidity =0.8.27;

interface ICiphexPayout {
    error ZeroAddress();
    error ZeroValue();
    error LenghMistmatch();
    event RewardsDeposited(
        address indexed recipient,
        uint256 cpxAmount,
        uint256 usdAmount
    );

    function depositReward(
        address _recipient,
        uint256 _cpxAmount,
        uint256 _usdAmount
    ) external;

    function depositRewards(
        address[] calldata _recipients,
        uint256[] calldata _cpxAmounts,
        uint256[] calldata _usdAmounts
    ) external;
}
