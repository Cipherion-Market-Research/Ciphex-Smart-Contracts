import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import { ciphexModule } from "./CiphexToken";
export const presaleAndStakingModule = buildModule("PresaleAndStaking", (m) => {
  const { timeLock, ciphex, ciphexAdmin } = m.useModule(ciphexModule);
  const presaleImpl = m.contract("CiphexPresale", []);
  const stakingImpl = m.contract("CiphexStaking", []);
  const presaleProxy = m.contract(
    "TransparentUpgradeableProxy",
    [presaleImpl, timeLock, "0x"],
    { id: "presaleProxy" }
  );
  const stakingProxy = m.contract(
    "TransparentUpgradeableProxy",
    [stakingImpl, timeLock, "0x"],
    { id: "stakingProxy" }
  );
  const presaleProxyAdminAddress = m.readEventArgument(
    presaleProxy,
    "AdminChanged",
    "newAdmin",
    { id: "presaleAdmin" }
  );
  const stakingProxyAdminAddress = m.readEventArgument(
    stakingProxy,
    "AdminChanged",
    "newAdmin",
    { id: "stakingAdmin" }
  );
  const presale = m.contractAt("CiphexPresale", presaleProxy, {
    id: "CiphexPresaleProxy",
  });
  const presaleAdmin = m.contractAt("ProxyAdmin", presaleProxyAdminAddress, {
    id: "PresaleAdmin",
  });
  const staking = m.contractAt("CiphexStaking", stakingProxy, {
    id: "CiphexStakingProxy",
  });
  const stakingAdmin = m.contractAt("ProxyAdmin", stakingProxyAdminAddress, {
    id: "StakingAdmin",
  });
  m.call(presale, "initialize", [
    m.getParameter("usdc"),
    m.getParameter("usdt"),
    m.getParameter("priceFeed"),
  ]);
  m.call(staking, "initialize", [
    ciphex,
    presale,
    m.getParameter("rewardIndex"),
  ]);

  return {
    timeLock,
    ciphex,
    ciphexAdmin,
    presale,
    presaleAdmin,
    staking,
    stakingAdmin,
  };
});
export default presaleAndStakingModule;
