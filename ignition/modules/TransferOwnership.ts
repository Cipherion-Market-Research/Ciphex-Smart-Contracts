import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import presaleAndStakingModule from "./PresaleAndStaking";

export const transferOwnership = buildModule("TransferOwnership", (m) => {
  const multisignatureContract = m.getParameter("multisignatureAddress");
  const {
    timeLock,
    ciphex,
    ciphexAdmin,
    presale,
    presaleAdmin,
    staking,
    stakingAdmin,
  } = m.useModule(presaleAndStakingModule);
  m.call(presale, "transferOwnership", [multisignatureContract], {
    id: "TransferPresaleOwnershipToMultisigWallet",
  });
  m.call(staking, "transferOwnership", [timeLock], {
    id: "TransferStakingOwnershipToTimeLock",
  });
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
export default transferOwnership;
