import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("ChainVouchModule", (m) => {
  const projectRegistry = m.contract("ProjectRegistry");
  const vouchLog = m.contract("VouchLog");
  const endorsementLog = m.contract("EndorsementLog");

  return { projectRegistry, vouchLog, endorsementLog };
});
