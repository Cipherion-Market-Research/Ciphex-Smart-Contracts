// SPDX-License-Identifier: MIT
pragma solidity =0.8.27;

import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20BurnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";

contract Ciphex is
    ERC20PausableUpgradeable,
    ERC20BurnableUpgradeable,
    AccessControlUpgradeable
{
    error ZeroAddress();
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    uint256 public constant MAX_SUPPLY = 1_500_000_000 * 10 ** 18;
    constructor() {
        _disableInitializers();
    }

    function initialize(
        address defaultAdmin,
        address initialTokenHolder
    ) public initializer {
        __ERC20_init("Ciphex", "CPX");
        __ERC20Pausable_init();
        __ERC20Burnable_init();
        __AccessControl_init();
        if (defaultAdmin == address(0) || initialTokenHolder == address(0))
            revert ZeroAddress();
        _grantRole(DEFAULT_ADMIN_ROLE, defaultAdmin);
        _grantRole(PAUSER_ROLE, defaultAdmin);
        _mint(initialTokenHolder, MAX_SUPPLY);
    }

    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    function _update(
        address from,
        address to,
        uint256 value
    )
        internal
        virtual
        override(ERC20Upgradeable, ERC20PausableUpgradeable)
        whenNotPaused
    {
        super._update(from, to, value);
    }
}
