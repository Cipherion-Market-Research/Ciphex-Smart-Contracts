// SPDX-License-Identifier: MIT
pragma solidity =0.8.27;

interface IContributionReserves {
    error ZeroAddress();
    error ZeroValue();
    error InvalidTokenAddress();
    error InvalidDecimals();
    error NotEnoughEth();
    error NotEnoughCiphex();
    error EthTransferError();
    error LenghMistmatch();
    error ContributionsNotActive();
    error InvalidConnect();
    error ContributionsAlreadyOpened();
    error ExceedsMaxContribution();
    error InvalidStage(uint256 stage);
    error StageMinimumNotMet(uint8 stage, uint256 amount, uint256 minimum);
    error UnexpectedEth();
    error NotEnoughStageSupply();
    error NotUpdatedPriceFeed();
    error UnexpectedStage(uint8 expectedStage, uint8 currentStage);

    event StatusUpdated(address indexed token, bool status);
    event ContributionsOpened(
        uint256 indexed start,
        address indexed reserveRecipient,
        address ciphex,
        address staking,
        uint256 allocation
    );
    event StageAdvanced(
        uint8 indexed closedStage,
        uint8 indexed nextStage,
        uint256 start,
        bool expired
    );
    event StageClosed(uint8 indexed stage, uint256 end, uint256 remaining);
    event ContributionsCompleted(uint256 end, uint256 unusedCpx);
    event Contributed(
        address indexed recipient,
        address indexed connect,
        address paymentToken,
        uint256 acceptedCpx,
        uint256 paymentCollected,
        uint256 ethPrice
    );

    function initialize(address usdc, address usdt, address priceFeed) external;

    function openContributions(
        address ciphex,
        address staking,
        address reserveRecipient
    ) external;

    function synchronize() external;

    function closeStage(uint8 expectedStage) external;

    function setStableStatus(address token, bool status) external;

    function quoteContribution(
        address paymentToken,
        uint256 requestedCpx
    ) external view returns (uint256 acceptedCpx, uint256 paymentRequired);

    function contribute(
        address paymentToken,
        uint256 requestedCpx,
        address recipient,
        address connect
    ) external payable;

    function withdrawFunds(
        address[] calldata tokens,
        address[] calldata recipients,
        uint256[] calldata values
    ) external;
}
