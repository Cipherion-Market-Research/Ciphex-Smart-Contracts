import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { ethers } from "ethers";
const ownable2StepUpgradeableABI = ["function acceptOwnership()"];
export const timeLockModule = buildModule("TimeLock", (m) => {
  const multisignatureContract = m.getParameter("multisignatureAddress");
  const lockDuration = m.getParameter("lockDuration");
  const timeLock = m.contract("TimelockController", [
    lockDuration,
    [multisignatureContract],
    [multisignatureContract],
    multisignatureContract,
  ]);
  return { timeLock };
});
export default timeLockModule;
