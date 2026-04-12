import { expect } from "chai";
import { network } from "hardhat";

const { ethers } = await network.connect();

describe("VouchLog", function () {
  async function deploy() {
    const vouchLog = await ethers.deployContract("VouchLog");
    return { vouchLog };
  }

  it("Should emit VouchRecorded when recording a vouch", async function () {
    const { vouchLog } = await deploy();

    await expect(
      vouchLog.recordVouch("proj-1", "alice", "bob", "0x00", 0, "great work")
    )
      .to.emit(vouchLog, "VouchRecorded")
      .withArgs("proj-1", "alice", "bob", "0x00", await ethers.provider.getBlock("latest").then(b => b!.timestamp + 1), 0, "great work");
  });

  it("Should increment event count after recording", async function () {
    const { vouchLog } = await deploy();

    expect(await vouchLog.getEventCount()).to.equal(0n);
    await vouchLog.recordVouch("proj-1", "alice", "bob", "0x00", 0, "reason");
    expect(await vouchLog.getEventCount()).to.equal(1n);
  });

  it("Should revert when a maintainer tries to vouch for themselves", async function () {
    const { vouchLog } = await deploy();

    await expect(
      vouchLog.recordVouch("proj-1", "alice", "alice", "0x00", 0, "self vouch")
    ).to.be.revertedWith("ChainVouch: Cannot vouch for yourself");
  });

  it("getVouchesFor should return only vouches for the given project/contributor", async function () {
    const { vouchLog } = await deploy();

    await vouchLog.recordVouch("proj-1", "alice", "bob", "0x00", 0, "good");
    await vouchLog.recordVouch("proj-1", "alice", "carol", "0x00", 0, "also good");
    await vouchLog.recordVouch("proj-2", "alice", "dave", "0x00", 0, "other project");
    await vouchLog.recordVouch("proj-1", "eve", "bob", "0x00", 0, "different contributor");

    const vouches = await vouchLog.getVouchesFor("proj-1", "alice");
    expect(vouches.length).to.equal(2);
    expect(vouches[0].maintainer).to.equal("bob");
    expect(vouches[1].maintainer).to.equal("carol");
  });

  it("getVouchesFor should not return denouncements", async function () {
    const { vouchLog } = await deploy();

    await vouchLog.recordVouch("proj-1", "alice", "bob", "0x00", 0, "vouch");
    await vouchLog.recordVouch("proj-1", "alice", "carol", "0x00", 1, "denounce");

    const vouches = await vouchLog.getVouchesFor("proj-1", "alice");
    expect(vouches.length).to.equal(1);
    expect(vouches[0].maintainer).to.equal("bob");
  });

  it("getDenouncements should return only denouncements for the given project/contributor", async function () {
    const { vouchLog } = await deploy();

    await vouchLog.recordVouch("proj-1", "alice", "bob", "0x00", 0, "vouch");
    await vouchLog.recordVouch("proj-1", "alice", "carol", "0x00", 1, "denounce");
    await vouchLog.recordVouch("proj-2", "alice", "dave", "0x00", 1, "other project denounce");

    const denouncements = await vouchLog.getDenouncements("proj-1", "alice");
    expect(denouncements.length).to.equal(1);
    expect(denouncements[0].maintainer).to.equal("carol");
  });

  it("getDenouncements should return empty array when none exist", async function () {
    const { vouchLog } = await deploy();

    await vouchLog.recordVouch("proj-1", "alice", "bob", "0x00", 0, "vouch");

    const denouncements = await vouchLog.getDenouncements("proj-1", "alice");
    expect(denouncements.length).to.equal(0);
  });
});
