# Security Policy

## Reporting a Vulnerability

Email **security@ciphex.io** with details and reproduction steps. We will acknowledge your report within 48 hours.

Please do not disclose the vulnerability publicly until we confirm remediation. Coordinate with us on timing -- we want to fix issues before they can be exploited.

If you find a security issue in any CipheX smart contract, we want to hear about it. We promise to respond within 48 hours and will not take legal action against researchers who report issues responsibly.

---

## Scope

### In Scope

All production smart contracts deployed on Ethereum mainnet:

| Contract | Address |
|----------|---------|
| CPX Token (implementation) | [`0x00cB388c55e8A21AB73181c0A68583673c9b56d9`](https://etherscan.io/address/0x00cB388c55e8A21AB73181c0A68583673c9b56d9) |
| CiphexPresale (implementation) | [`0xf48fbaa8af52498f7b1e8f51f0a660d9023db4bc`](https://etherscan.io/address/0xf48fbaa8af52498f7b1e8f51f0a660d9023db4bc) |
| CiphexPresale (proxy) | [`0x28995579fdf4F1Ea01ba54b6F4f0524cE63Ff1bc`](https://etherscan.io/address/0x28995579fdf4F1Ea01ba54b6F4f0524cE63Ff1bc) |
| CiphexStaking (active implementations + proxies) | See [deployments/ethereum-mainnet.json](./deployments/ethereum-mainnet.json) |
| CiphexPayout (implementation) | [`0xcCE8DaE6314116846C1930D68FdfcC29870708BA`](https://etherscan.io/address/0xcCE8DaE6314116846C1930D68FdfcC29870708BA) |
| CiphexPayout (proxy) | [`0x3c4fEFCDC575fc1a3b3b094E1C96E35E9094db6A`](https://etherscan.io/address/0x3c4fEFCDC575fc1a3b3b094E1C96E35E9094db6A) |
| TimelockController | [`0x567fAb3B2dFa635a4257FF742610D22E92c32400`](https://etherscan.io/address/0x567fAb3B2dFa635a4257FF742610D22E92c32400) |

### Out of Scope

- Deprecated staking implementation `0x76aa9c76...` (no longer referenced by any proxy)
- Mock and test contracts in `/contracts/mocks/` and `/contracts/test/`
- Websites, frontends, and off-chain infrastructure (unless explicitly opted in -- see bug bounty program)
- Issues already reported in the CertiK Final Report v2 (December 2024)

---

## Security Controls

All admin operations follow the same governance path:

```
3-of-5 Gnosis Safe --> 48h TimelockController --> ProxyAdmin --> Contract
```

- **Upgrades** are exceptional. Any upgrade will be announced publicly before the timelock proposal is submitted, executed only after the 48-hour delay, and documented in the contract registry within 24 hours of execution.
- **No mint function** exists. Supply cannot be increased.
- **No tax, blacklist, or balance-editing** functions exist.
- **Emergency pause** is gated by the same 3/5 + 48h timelock path. It has never been used.

---

## Audit

**Auditor:** CertiK
**Report:** Final Report v2, December 2024
**Scope commit:** `4d04720c69dcde1053fe07ef7be4ad2a59ec271c`
**Files:** Ciphex.sol, CiphexPresale.sol, CiphexStaking.sol
**CertiK Skynet:** [skynet.certik.com/projects/ciphex](https://skynet.certik.com/projects/ciphex)

12 findings, 12 closed (8 resolved, 3 mitigated, 1 acknowledged by design). Zero open findings. A CertiK addendum covering post-audit staking and payout changes is in progress.

---

## Bug Bounty

### Rules

- **No mainnet exploitation.** Proof-of-concept must be demonstrated on a local fork only.
- **First report wins.** Duplicate reports for the same vulnerability will not be rewarded.
- **Responsible disclosure.** Do not share vulnerability details publicly until remediation is confirmed.
- **Safe harbor applies** (see below).

### Reward Tiers

Reward tiers to be published.

---

## Safe Harbor

Good-faith security research conducted within the scope defined above will not be subject to legal action by CipheX. To qualify:

- Your research must stay within the scope listed above.
- You must not exploit any vulnerability on mainnet or cause loss of funds.
- You must report findings promptly via security@ciphex.io.
- You must not disclose findings publicly before remediation is confirmed.

---

## Repository Tags

- `cpx-audit-2024-12` -- the exact commit audited by CertiK
- `cpx-deployed-v2026-06` -- the current deployed state as verified on Etherscan

---

## Additional Resources

- Full security documentation: [ciphex.io/security](https://ciphex.io/security)
- CertiK Skynet profile: [skynet.certik.com/projects/ciphex](https://skynet.certik.com/projects/ciphex)
- Contract registry and governance details: see [README.md](./README.md)
