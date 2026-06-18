// SPDX-License-Identifier: MIT
pragma solidity =0.8.27;

interface ICiphexPresale {
    error ZeroAddress();
    error ZeroValue();
    error InvalidTokenAddress();
    error InvalidDecimals();
    error NotEnoughEth();
    error NotEnoughCiphex();
    error EthTransferError();
    error LenghMistmatch();
    error NotActivePresale();
    error InvalidReferral();
    error PresaleAlreadyStarted();
    error NotUpdatedPriceFeed();
    event StatusUpdated(address token, bool status);
    event Bought(
        address indexed recipient,
        address indexed referral,
        address token,
        uint256 tokenAmount,
        uint256 ciphexAmount,
        uint256 ethPrice,
        uint256 tokenPrice
    );
    event PresaleStarted(uint256 start, uint256 end, uint256 ciphexSupply);
    function setStableStatus(address _token, bool _status) external;
    function startPresale(
        address _ciphex,
        address _staking,
        uint256 _ciphexAmount,
        uint32 _presaleDuration
    ) external;
    function withdrawFunds(
        address[] calldata _tokens,
        address[] calldata _recipients,
        uint256[] calldata _values
    ) external;
    function buy(
        address _token,
        uint256 _amount,
        address _recipient,
        address _referral
    ) external payable;
}
