# CipheX (CPX) Smart Contracts

Audited, Ethereum-verified source code for the CipheX (CPX) ERC-20 token and supporting infrastructure.

Every `.sol` file in this repository is byte-identical to the Etherscan-verified source deployed on Ethereum mainnet and audited by CertiK in December 2024. There are zero differences between this repository and the on-chain state.

## Token at a Glance

| Property | Value |
|----------|-------|
| **Token** | CipheX (CPX) |
| **Standard** | ERC-20, OpenZeppelin TransparentUpgradeableProxy (EIP-1967) |
| **Chain** | Ethereum Mainnet |
| **Decimals** | 18 |
| **Canonical address** | [`0x18b33687d1c804Dd4ea6c82106e54923c23a652E`](https://etherscan.io/token/0x18b33687d1c804Dd4ea6c82106e54923c23a652E) |
| **Genesis supply** | 1,500,000,000 CPX (minted once at initialization; no mint function exists) |
| **Permanently removed** | 481,454,298 CPX transferred to `0x...dEaD` on January 1, 2026 |
| **Effective circulating supply** | 1,018,545,702 CPX |
| **Deployed** | December 9, 2024 (block 21364284) |

> **Note on `totalSupply()`:** The on-chain `totalSupply()` returns 1,500,000,000 because tokens were transferred to the canonical dead address (`0x000...dEaD`), not burned via an ERC-20 `burn()` function. The dead-address balance is verifiable on-chain.

---

## Deployed Contracts

All contracts are deployed on Ethereum mainnet. Proxy contracts use OpenZeppelin's TransparentUpgradeableProxy pattern.

| Contract | Type | Address | Etherscan |
|----------|------|---------|-----------|
| **CPX Token** (proxy) | TransparentUpgradeableProxy | `0x18b33687d1c804Dd4ea6c82106e54923c23a652E` | [View](https://etherscan.io/address/0x18b33687d1c804Dd4ea6c82106e54923c23a652E) |
| CPX Token (implementation) | Ciphex.sol | `0x00cB388c55e8A21AB73181c0A68583673c9b56d9` | [View](https://etherscan.io/address/0x00cB388c55e8A21AB73181c0A68583673c9b56d9) |
| **TimelockController** | OpenZeppelin TimelockController | `0x567fAb3B2dFa635a4257FF742610D22E92c32400` | [View](https://etherscan.io/address/0x567fAb3B2dFa635a4257FF742610D22E92c32400) |
| **Gnosis Safe** (multisig) | Safe v1.4.1 | `0xDC75B0c5D94816C27458ed62BEc10474A7Fc4231` | [View](https://etherscan.io/address/0xDC75B0c5D94816C27458ed62BEc10474A7Fc4231) |
| **Presale** (proxy) | TransparentUpgradeableProxy | `0x28995579fdf4F1Ea01ba54b6F4f0524cE63Ff1bc` | [View](https://etherscan.io/address/0x28995579fdf4F1Ea01ba54b6F4f0524cE63Ff1bc) |
| Presale (implementation) | CiphexPresale.sol | `0xf48fbaa8af52498f7b1e8f51f0a660d9023db4bc` | [View](https://etherscan.io/address/0xf48fbaa8af52498f7b1e8f51f0a660d9023db4bc) |
| **Staking** (proxy -- primary) | TransparentUpgradeableProxy | `0x60f36DaeFEcB66EcB998655989Db45f12D08167d` | [View](https://etherscan.io/address/0x60f36DaeFEcB66EcB998655989Db45f12D08167d) |
| Staking (implementation -- primary) | CiphexStaking.sol | `0xcAfdDC4be43101F5F044dB5A86E9852DFc1f6122` | [View](https://etherscan.io/address/0xcAfdDC4be43101F5F044dB5A86E9852DFc1f6122) |
| **Staking** (proxy -- presale lockup) | TransparentUpgradeableProxy | `0xc626b88a2fA52cfee8A695fE0779ecD83B943b21` | [View](https://etherscan.io/address/0xc626b88a2fA52cfee8A695fE0779ecD83B943b21) |
| Staking (implementation -- presale lockup) | CiphexStaking.sol | `0x270368A5827d7f1740bEF66d09bE612FE03f921c` | [View](https://etherscan.io/address/0x270368A5827d7f1740bEF66d09bE612FE03f921c) |
| **Staking** (proxy -- private round) | TransparentUpgradeableProxy | `0xfde5bbBFba12E55765b4F20176e7ac036b988478` | [View](https://etherscan.io/address/0xfde5bbBFba12E55765b4F20176e7ac036b988478) |
| Staking (implementation -- private round) | CiphexStaking.sol | `0xAD7fbcddF64Ce2238E7271360a2EDf5ccE706D5C` | [View](https://etherscan.io/address/0xAD7fbcddF64Ce2238E7271360a2EDf5ccE706D5C) |
| **Payout** (proxy) | TransparentUpgradeableProxy | `0x3c4fEFCDC575fc1a3b3b094E1C96E35E9094db6A` | [View](https://etherscan.io/address/0x3c4fEFCDC575fc1a3b3b094E1C96E35E9094db6A) |
| Payout (implementation) | CiphexPayout.sol | `0xcCE8DaE6314116846C1930D68FdfcC29870708BA` | [View](https://etherscan.io/address/0xcCE8DaE6314116846C1930D68FdfcC29870708BA) |

A machine-readable version of this table is available at [`deployments/ethereum-mainnet.json`](./deployments/ethereum-mainnet.json).

---

## Governance Architecture

```
  3-of-5 Gnosis Safe (0xDC75...4231)
            |
            v
  48-hour TimelockController (0x567f...2400)
            |
            v
  ProxyAdmin (per contract)
            |
            v
  Contract Proxy --> Implementation
```

Every privileged operation -- upgrades, role changes, parameter modifications -- requires approval from at least 3 of 5 multisig signers followed by a mandatory 48-hour public waiting period enforced by the on-chain TimelockController. The timelock delay is set to 172,800 seconds and is verifiable by calling `getMinDelay()` on the TimelockController.

**No single person can unilaterally change any contract.** There is no mint function, no tax mechanism, no blacklist function, and no balance-editing capability.

The emergency pause function exists but is gated by the same 3/5 + 48h timelock path. It has never been used.

---

## Security Audit

**Auditor:** CertiK
**Report:** Final Report v2, December 2024
**Scope commit:** `4d04720c69dcde1053fe07ef7be4ad2a59ec271c`
**Audited files:** Ciphex.sol, CiphexPresale.sol, CiphexStaking.sol (SHA-256 checksums published on CertiK Skynet)
**CertiK Skynet:** [skynet.certik.com/projects/ciphex](https://skynet.certik.com/projects/ciphex)

**Findings summary:** 12 findings identified, 12 closed (8 resolved, 3 mitigated, 1 acknowledged by design). Zero open findings. The three major findings were centralization-class issues mitigated structurally by the multisig + timelock architecture.

**Post-audit changes:**

- `Ciphex.sol`: `initialize()` signature updated to accept a separate `initialTokenHolder` parameter (supply minted to designated holder rather than `defaultAdmin`). Implementation deployed at `0x00cB388c...` matches repository.
- `CiphexStaking.sol`: Updated implementation deployed August 2025 (vesting-handling changes). CertiK addendum in progress.
- `CiphexPayout.sol`: New contract deployed July 2025, outside original audit scope. CertiK addendum in progress.

---

## Verify It Yourself

Every contract in this repo is verified on Etherscan. You can independently confirm that the source code here matches the deployed bytecode:

1. **Compare source:** Open any contract address from the table above on Etherscan. Click the "Contract" tab, then "Code." The verified Solidity source should match the corresponding `.sol` file in this repository exactly.

2. **Check proxy implementation:** For proxy contracts, use Etherscan's "Read as Proxy" tab to confirm the implementation address matches the table above.

3. **Verify governance:** Call `getMinDelay()` on the [TimelockController](https://etherscan.io/address/0x567fAb3B2dFa635a4257FF742610D22E92c32400#readContract) to confirm the 48-hour (172,800 second) delay. Call `getOwners()` and `getThreshold()` on the [Safe](https://etherscan.io/address/0xDC75B0c5D94816C27458ed62BEc10474A7Fc4231) to confirm 3-of-5.

4. **Verify supply:** Call `totalSupply()` on the [CPX token](https://etherscan.io/address/0x18b33687d1c804Dd4ea6c82106e54923c23a652E#readContract) (returns 1,500,000,000 * 10^18). Call `balanceOf(0x000000000000000000000000000000000000dEaD)` to confirm the permanently removed balance.

---

## Repository Structure

```
contracts/
  Ciphex.sol                  # ERC-20 token (upgradeable)
  CiphexPresale.sol           # Presale/claim contract
  CiphexStaking.sol           # Staking with vesting
  CiphexPayout.sol            # Reward payout distribution
  interfaces/
    ICiphexPresale.sol
    ICiphexStaking.sol
deployments/
  ethereum-mainnet.json       # Canonical address registry (machine-readable)
ignition/
  modules/                    # Hardhat Ignition deployment modules
  parametersEthereum.json     # Mainnet deployment parameters
test/
  Ciphex.test.ts
  Presale.test.ts
  Staking.test.ts
audits/
  REP-CipheX---Audit__final-20241211T011723Z.pdf
```

---

## Build & Test

```bash
npm install
npx hardhat compile
npx hardhat test
```

Requires Node.js >= 16 and a mainnet RPC endpoint for fork testing. Copy `rpcs.template.json` to `rpcs.json` and populate your RPC URLs.

---

## Technology

- Solidity 0.8.27
- OpenZeppelin Contracts v5.0.1 (upgradeable)
- Hardhat framework with Ignition deployment modules
- TypeScript tests with Chai/Mocha

---

## Security

See [SECURITY.md](./SECURITY.md) for vulnerability reporting, bug bounty scope, and safe harbor policy.

Full security documentation is also published at [ciphex.io/security](https://ciphex.io/security).

---

## License

See [LICENSE](./LICENSE). Brand assets and marks are the proprietary property of Ciphex. Smart contract source code carries `SPDX-License-Identifier: MIT` in each file.

---

## About

CipheX is capital-markets infrastructure for the tokenized economy, bridging traditional finance and digital assets. CipheX is an ecosystem by [Cipherion](https://ciphex.io).
