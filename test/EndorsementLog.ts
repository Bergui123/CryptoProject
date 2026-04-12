import { expect } from "chai";
import { network } from "hardhat";

const { ethers } = await network.connect();

describe("EndorsementLog", function () {
  async function deploy() {
    const endorsementLog = await ethers.deployContract("EndorsementLog");
    return { endorsementLog };
  }

  it("Should emit EndorsementRecorded when recording an endorsement", async function () {
    const { endorsementLog } = await deploy();

    await expect(
      endorsementLog.recordEndorsement("proj-a", "proj-b", "alice", "0x00")
    ).to.emit(endorsementLog, "EndorsementRecorded");
  });

  it("Should increment endorsement count after recording", async function () {
    const { endorsementLog } = await deploy();

    expect(await endorsementLog.getEndorsementCount()).to.equal(0n);
    await endorsementLog.recordEndorsement("proj-a", "proj-b", "alice", "0x00");
    expect(await endorsementLog.getEndorsementCount()).to.equal(1n);
  });

  it("getEndorsementsFor should return endorsements targeting the given project", async function () {
    const { endorsementLog } = await deploy();

    await endorsementLog.recordEndorsement("proj-a", "proj-b", "alice", "0x00");
    await endorsementLog.recordEndorsement("proj-c", "proj-b", "bob", "0x00");
    await endorsementLog.recordEndorsement("proj-a", "proj-c", "carol", "0x00");

    const endorsements = await endorsementLog.getEndorsementsFor("proj-b");
    expect(endorsements.length).to.equal(2);
    expect(endorsements[0].sourceProjectId).to.equal("proj-a");
    expect(endorsements[1].sourceProjectId).to.equal("proj-c");
  });

  it("getEndorsementsFor should return empty array when no endorsements exist", async function () {
    const { endorsementLog } = await deploy();

    await endorsementLog.recordEndorsement("proj-a", "proj-b", "alice", "0x00");

    const endorsements = await endorsementLog.getEndorsementsFor("proj-c");
    expect(endorsements.length).to.equal(0);
  });

  it("getEndorsementsFor should not return endorsements targeting other projects", async function () {
    const { endorsementLog } = await deploy();

    await endorsementLog.recordEndorsement("proj-a", "proj-b", "alice", "0x00");
    await endorsementLog.recordEndorsement("proj-a", "proj-c", "bob", "0x00");

    const endorsements = await endorsementLog.getEndorsementsFor("proj-b");
    expect(endorsements.length).to.equal(1);
    expect(endorsements[0].targetProjectId).to.equal("proj-b");
  });
});
