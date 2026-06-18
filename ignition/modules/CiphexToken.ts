import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import { timeLockModule } from "./TimeLock";

export const ciphexModule = buildModule("CiphexToken", (m) => {
  const multisignatureContract = m.getParameter("multisignatureAddress");
  const { timeLock } = m.useModule(timeLockModule);
  const ciphexImpl = m.contract("Ciphex", []);
  const proxy = m.contract("TransparentUpgradeableProxy", [
    ciphexImpl,
    timeLock,
    "0x",
  ]);
  const proxyAdminAddress = m.readEventArgument(
    proxy,
    "AdminChanged",
    "newAdmin"
  );
  const ciphex = m.contractAt("Ciphex", proxy, {
    id: "CiphexToken",
  });
  m.call(ciphex, "initialize", [timeLock, multisignatureContract]);
  const ciphexAdmin = m.contractAt("ProxyAdmin", proxyAdminAddress, {
    id: "CiphexTokenAdmin",
  });
  return { timeLock, ciphex, ciphexAdmin };
});
export default ciphexModule;
