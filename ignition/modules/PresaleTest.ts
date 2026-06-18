import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("PresaleTest", (m) => {
  const presaleTestImpl = m.contract("PresaleTest", []);
  return { presaleTest: presaleTestImpl };
});
