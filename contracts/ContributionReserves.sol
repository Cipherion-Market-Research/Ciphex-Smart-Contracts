// SPDX-License-Identifier: MIT
pragma solidity =0.8.27;

import {Ownable2StepUpgradeable} from "@openzeppelin/contracts-upgradeable/access/Ownable2StepUpgradeable.sol";
import {ReentrancyGuardUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {AggregatorV3Interface} from "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";
import {ICiphexContributionsStaking} from "./interfaces/ICiphexContributionsStaking.sol";
import {IContributionReserves} from "./interfaces/IContributionReserves.sol";

/// @title ContributionReserves
/// @notice Upgradeable, fixed-price CPX contributions contract with three stages.
/// @dev Stage supply is not rolled forward after expiry or early close. It is
///      returned to the reserve recipient only when contributions complete.
contract ContributionReserves is
    Ownable2StepUpgradeable,
    ReentrancyGuardUpgradeable,
    IContributionReserves
{
    using SafeERC20 for IERC20Metadata;

    uint256 public constant PRECISION = 1 ether;
    uint256 public constant USD_DECIMALS = 6;
    uint256 public constant DAY = 1 days;
    uint256 public constant ETH_USD_MAX_AGE = 1 hours + 5 minutes;
    uint256 public constant STAGE_DURATION = 30 days;
    uint8 public constant STAGE_COUNT = 3;

    uint32 public constant CONTRIBUTION_PRICE = 200_000;
    uint256 public constant CONTRIBUTIONS_ALLOCATION = 70_000_000 ether;
    uint256 public constant MAX_CONTRIBUTION = 100_000 ether;

    uint256 public constant STAGE_1_ALLOCATION = 7_000_000 ether;
    uint256 public constant STAGE_2_ALLOCATION = 21_000_000 ether;
    uint256 public constant STAGE_3_ALLOCATION = 42_000_000 ether;
    uint256 public constant STAGE_1_MINIMUM = 1_000 ether;
    uint256 public constant STAGE_2_MINIMUM = 2_000 ether;
    uint256 public constant STAGE_3_MINIMUM = 3_000 ether;

    address public ciphex;
    address public staking;
    address public usdc;
    address public usdt;
    address public priceFeed;
    address public reserveRecipient;

    mapping(address => bool) public tokenStatus;
    mapping(uint8 => uint32) public stageStarts;
    mapping(uint8 => uint256) public stageSold;

    // 0 means unopened, 1..3 are active, and 4 means completed.
    uint8 public currentStage;
    bool public contributionsOpened;
    bool public contributionsClosed;
    uint32 public contributionsStart;
    uint32 public contributionsEnd;

    constructor() {
        _disableInitializers();
    }

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
        priceFeed = _priceFeed;
        tokenStatus[_usdc] = true;
        tokenStatus[_usdt] = true;

        __Ownable_init(_msgSender());
        __ReentrancyGuard_init();
    }

    /// @notice Opens contributions once and escrows exactly 70M CPX from the owner.
    function openContributions(
        address _ciphex,
        address _staking,
        address _reserveRecipient
    ) external onlyOwner {
        if (contributionsOpened) revert ContributionsAlreadyOpened();
        if (
            _ciphex == address(0) ||
            _staking == address(0) ||
            _reserveRecipient == address(0)
        ) revert ZeroAddress();
        if (IERC20Metadata(_ciphex).decimals() != 18) revert InvalidDecimals();

        ciphex = _ciphex;
        staking = _staking;
        reserveRecipient = _reserveRecipient;
        contributionsOpened = true;
        contributionsStart = uint32(block.timestamp);
        currentStage = 1;
        stageStarts[1] = contributionsStart;

        IERC20Metadata(_ciphex).safeTransferFrom(
            _msgSender(),
            address(this),
            CONTRIBUTIONS_ALLOCATION
        );
        emit ContributionsOpened(
            block.timestamp,
            _reserveRecipient,
            _ciphex,
            _staking,
            CONTRIBUTIONS_ALLOCATION
        );
    }

    /// @notice Permissionlessly catches up every stage whose deadline passed.
    function synchronize() external {
        _synchronize();
    }

    /// @notice Ends the expected current stage and advances the lifecycle.
    function closeStage(uint8 _expectedStage) external onlyOwner {
        _synchronize();
        if (_expectedStage != currentStage) {
            revert UnexpectedStage(_expectedStage, currentStage);
        }
        if (!isContributionsActive()) revert ContributionsNotActive();

        uint8 closedStage = currentStage;
        emit StageClosed(
            closedStage,
            block.timestamp,
            stageRemaining(closedStage)
        );
        _advanceStage(closedStage, block.timestamp, false);
    }

    function setStableStatus(address _token, bool _status) external onlyOwner {
        if (_token != usdc && _token != usdt) revert InvalidTokenAddress();
        tokenStatus[_token] = _status;
        emit StatusUpdated(_token, _status);
    }

    function quoteContribution(
        address _paymentToken,
        uint256 _requestedCpx
    ) external view returns (uint256 acceptedCpx, uint256 paymentRequired) {
        if (!contributionsOpened || contributionsClosed) return (0, 0);
        _validatePaymentToken(_paymentToken);
        if (_requestedCpx == 0) return (0, 0);
        if (_requestedCpx > MAX_CONTRIBUTION)
            revert ExceedsMaxContribution();

        (uint8 virtualStage, uint256 capacity) = _availableCapacity();
        if (virtualStage > STAGE_COUNT || capacity == 0) return (0, 0);
        if (_requestedCpx < stageMinimum(virtualStage)) {
            revert StageMinimumNotMet(
                virtualStage,
                _requestedCpx,
                stageMinimum(virtualStage)
            );
        }

        acceptedCpx = _requestedCpx < capacity ? _requestedCpx : capacity;
        (paymentRequired, ) = _paymentFor(_paymentToken, acceptedCpx);
    }

    /// @notice Recalculates stage capacity and payment at execution time.
    function contribute(
        address _paymentToken,
        uint256 _requestedCpx,
        address _recipient,
        address _connect
    ) external payable nonReentrant {
        if (_recipient == address(0)) revert ZeroAddress();
        if (_requestedCpx == 0) revert ZeroValue();
        if (_recipient == _connect) revert InvalidConnect();
        if (_requestedCpx > MAX_CONTRIBUTION)
            revert ExceedsMaxContribution();
        _validatePaymentToken(_paymentToken);

        _synchronize();
        if (!isContributionsActive()) revert ContributionsNotActive();

        uint8 startStage = currentStage;
        uint256 capacity = _availableCapacityAfterSynchronization();
        if (capacity == 0) revert NotEnoughStageSupply();
        if (_requestedCpx < stageMinimum(startStage)) {
            revert StageMinimumNotMet(
                startStage,
                _requestedCpx,
                stageMinimum(startStage)
            );
        }

        uint256 acceptedCpx = _requestedCpx < capacity
            ? _requestedCpx
            : capacity;
        (uint256 paymentCollected, uint256 ethPrice) = _paymentFor(
            _paymentToken,
            acceptedCpx
        );

        if (_paymentToken == address(0)) {
            if (msg.value < paymentCollected) revert NotEnoughEth();
        } else {
            if (msg.value != 0) revert UnexpectedEth();
            IERC20Metadata(_paymentToken).safeTransferFrom(
                _msgSender(),
                address(this),
                paymentCollected
            );
        }

        _consumeContribution(startStage, acceptedCpx);

        IERC20Metadata(ciphex).safeIncreaseAllowance(staking, acceptedCpx);
        ICiphexContributionsStaking(staking).stake(_recipient, acceptedCpx);

        // Complete only after the aggregate stake has pulled its CPX. If the
        // contribution sold the final stage, completing before this call
        // would incorrectly return the accepted CPX to the reserve.
        _synchronize();

        if (_paymentToken == address(0) && msg.value > paymentCollected) {
            _transferEthTo(payable(_msgSender()), msg.value - paymentCollected);
        }
        emit Contributed(
            _recipient,
            _connect,
            _paymentToken,
            acceptedCpx,
            paymentCollected,
            ethPrice
        );
    }

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
            if (_recipients[i] == address(0)) revert ZeroAddress();
            if (_tokens[i] == address(0)) {
                _transferEthTo(payable(_recipients[i]), _values[i]);
            } else {
                // CPX remains reserved from opening through completion. This
                // must not depend on the current stage deadline: an expired
                // stage is not permission to withdraw the contributions
                // allocation.
                if (
                    _tokens[i] == ciphex &&
                    contributionsOpened &&
                    !contributionsClosed
                ) {
                    revert NotEnoughCiphex();
                }
                IERC20Metadata(_tokens[i]).safeTransfer(
                    _recipients[i],
                    _values[i]
                );
            }
        }
    }

    function isContributionsActive() public view returns (bool) {
        return
            contributionsOpened &&
            !contributionsClosed &&
            currentStage >= 1 &&
            currentStage <= STAGE_COUNT &&
            block.timestamp < stageDeadline(currentStage);
    }

    function isActive() external view returns (bool) {
        return isContributionsActive();
    }

    function isClosed() external view returns (bool) {
        return contributionsClosed;
    }

    function stageAllocation(uint8 _stage) public pure returns (uint256) {
        if (_stage == 1) return STAGE_1_ALLOCATION;
        if (_stage == 2) return STAGE_2_ALLOCATION;
        if (_stage == 3) return STAGE_3_ALLOCATION;
        revert InvalidStage(_stage);
    }

    function stageMinimum(uint8 _stage) public pure returns (uint256) {
        if (_stage == 1) return STAGE_1_MINIMUM;
        if (_stage == 2) return STAGE_2_MINIMUM;
        if (_stage == 3) return STAGE_3_MINIMUM;
        revert InvalidStage(_stage);
    }

    function stageRemaining(uint8 _stage) public view returns (uint256) {
        return stageAllocation(_stage) - stageSold[_stage];
    }

    function Early_Entry_Stage_Remaining_Tokens() external view returns (uint256) {
        return stageRemaining(1);
    }

    function Growth_Stage_Remaining_Tokens() external view returns (uint256) {
        return stageRemaining(2);
    }

    function Final_Stage_Remaining_Tokens() external view returns (uint256) {
        return stageRemaining(3);
    }

    function stageDeadline(uint8 _stage) public view returns (uint256) {
        uint32 start = stageStarts[_stage];
        return start == 0 ? 0 : uint256(start) + STAGE_DURATION;
    }

    function stageInfo(
        uint8 _stage
    )
        external
        view
        returns (
            uint256 allocation,
            uint256 sold,
            uint256 remaining,
            uint256 minimum,
            uint256 start,
            uint256 deadline,
            bool active
        )
    {
        allocation = stageAllocation(_stage);
        sold = stageSold[_stage];
        remaining = allocation - sold;
        minimum = stageMinimum(_stage);
        start = stageStarts[_stage];
        deadline = stageDeadline(_stage);
        active = isContributionsActive() && currentStage == _stage;
    }

    function totalSold() public view returns (uint256) {
        return stageSold[1] + stageSold[2] + stageSold[3];
    }

    function totalRemaining() public view returns (uint256) {
        return CONTRIBUTIONS_ALLOCATION - totalSold();
    }

    function getContributionsState()
        external
        view
        returns (
            bool active,
            bool closed,
            uint8 stage,
            uint256 start,
            uint256 deadline,
            uint256 sold,
            uint256 remaining
        )
    {
        active = isContributionsActive();
        closed = contributionsClosed;
        stage = currentStage;
        if (currentStage >= 1 && currentStage <= STAGE_COUNT) {
            start = stageStarts[currentStage];
            deadline = stageDeadline(currentStage);
        }
        sold = totalSold();
        remaining = totalRemaining();
    }

    function getEthPrice() public view returns (uint256) {
        return _getEthPrice();
    }

    function _consumeContribution(
        uint8 _startStage,
        uint256 _acceptedCpx
    ) internal {
        uint256 remainingToAllocate = _acceptedCpx;
        for (uint8 stage = _startStage; stage <= STAGE_COUNT; ++stage) {
            if (remainingToAllocate == 0) break;
            uint256 remaining = stageRemaining(stage);
            uint256 portion = remainingToAllocate < remaining
                ? remainingToAllocate
                : remaining;
            stageSold[stage] += portion;
            remainingToAllocate -= portion;
        }
        if (remainingToAllocate != 0) revert NotEnoughStageSupply();
    }

    function _synchronize() internal {
        if (!contributionsOpened || contributionsClosed) return;
        while (currentStage >= 1 && currentStage <= STAGE_COUNT) {
            uint8 stage = currentStage;
            if (stageSold[stage] == stageAllocation(stage)) {
                _advanceStage(stage, block.timestamp, false);
                continue;
            }
            uint256 deadline = stageDeadline(stage);
            if (block.timestamp < deadline) break;
            _advanceStage(stage, deadline, true);
        }
    }

    function _advanceStage(
        uint8 _closedStage,
        uint256 _nextStart,
        bool _expired
    ) internal {
        if (_closedStage == STAGE_COUNT) {
            _completeContributions();
            return;
        }
        uint8 nextStage = _closedStage + 1;
        currentStage = nextStage;
        stageStarts[nextStage] = uint32(_nextStart);
        emit StageAdvanced(_closedStage, nextStage, _nextStart, _expired);
    }

    function _completeContributions() internal {
        if (contributionsClosed) return;
        contributionsClosed = true;
        currentStage = STAGE_COUNT + 1;
        contributionsEnd = uint32(block.timestamp);
        uint256 unusedCpx = IERC20Metadata(ciphex).balanceOf(address(this));
        if (unusedCpx != 0) {
            IERC20Metadata(ciphex).safeTransfer(reserveRecipient, unusedCpx);
        }
        emit ContributionsCompleted(block.timestamp, unusedCpx);
    }

    function _availableCapacity()
        internal
        view
        returns (uint8 virtualStage, uint256 capacity)
    {
        virtualStage = currentStage;
        if (!contributionsOpened || contributionsClosed || virtualStage == 0) {
            return (virtualStage, 0);
        }

        uint256 start = stageStarts[virtualStage];
        while (
            virtualStage <= STAGE_COUNT &&
            block.timestamp >= start + STAGE_DURATION
        ) {
            virtualStage++;
            start += STAGE_DURATION;
        }
        if (virtualStage > STAGE_COUNT) return (virtualStage, 0);

        // The first non-expired stage is the starting stage for minimum and
        // spill validation. Its capacity and all later stage capacities are
        // available to the quote even before synchronization is mined.
        for (uint8 stage = virtualStage; stage <= STAGE_COUNT; ++stage) {
            capacity += stageRemaining(stage);
        }
        return (virtualStage, capacity);
    }

    function _availableCapacityAfterSynchronization()
        internal
        view
        returns (uint256 capacity)
    {
        for (uint8 stage = currentStage; stage <= STAGE_COUNT; ++stage) {
            capacity += stageRemaining(stage);
        }
    }

    function _paymentFor(
        address _paymentToken,
        uint256 _acceptedCpx
    ) internal view returns (uint256 payment, uint256 ethPrice) {
        uint256 usd = (_acceptedCpx * CONTRIBUTION_PRICE) / PRECISION;
        if (_paymentToken == address(0)) {
            ethPrice = _getEthPrice();
            payment = _ceilDiv(usd * PRECISION, ethPrice);
            return (payment, ethPrice);
        }
        return (usd, 0);
    }

    function _validatePaymentToken(address _paymentToken) internal view {
        if (
            _paymentToken != address(0) &&
            (_paymentToken != usdc || !tokenStatus[_paymentToken]) &&
            (_paymentToken != usdt || !tokenStatus[_paymentToken])
        ) revert InvalidTokenAddress();
    }

    function _getEthPrice() internal view returns (uint256) {
        (
            uint80 roundId,
            int256 answer,
            ,
            uint256 updatedAt,
            uint80 answeredInRound
        ) = AggregatorV3Interface(priceFeed).latestRoundData();
        if (
            answer <= 0 ||
            updatedAt == 0 ||
            updatedAt > block.timestamp ||
            answeredInRound < roundId ||
            block.timestamp - updatedAt > ETH_USD_MAX_AGE
        ) revert NotUpdatedPriceFeed();

        uint8 decimals = AggregatorV3Interface(priceFeed).decimals();
        uint256 price = uint256(answer);
        if (decimals > USD_DECIMALS) {
            return price / 10 ** (decimals - USD_DECIMALS);
        }
        if (decimals < USD_DECIMALS) {
            return price * 10 ** (USD_DECIMALS - decimals);
        }
        return price;
    }

    function _transferEthTo(address payable _recipient, uint256 _amount) internal {
        if (address(this).balance < _amount) revert NotEnoughEth();
        (bool sent, ) = _recipient.call{value: _amount}("");
        if (!sent) revert EthTransferError();
    }

    function _ceilDiv(uint256 _numerator, uint256 _denominator)
        internal
        pure
        returns (uint256)
    {
        if (_numerator == 0) return 0;
        return ((_numerator - 1) / _denominator) + 1;
    }

    receive() external payable {}
}
