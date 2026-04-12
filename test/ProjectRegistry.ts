import { expect } from "chai";
import { network } from "hardhat";

const { ethers } = await network.connect();

describe("ProjectRegistry", function () {
  async function deploy() {
    const [owner, other] = await ethers.getSigners();
    const projectRegistry = await ethers.deployContract("ProjectRegistry");
    return { projectRegistry, owner, other };
  }

  it("Should emit ProjectRegistered when registering a project", async function () {
    const { projectRegistry } = await deploy();

    await expect(
      projectRegistry.registerProject("my-project", ["alice", "bob"])
    ).to.emit(projectRegistry, "ProjectRegistered").withArgs("my-project", ["alice", "bob"], await ethers.provider.getBlock("latest").then(b => b!.timestamp + 1));
  });

  it("Should revert when registering an already-active project", async function () {
    const { projectRegistry } = await deploy();

    await projectRegistry.registerProject("my-project", ["alice"]);

    await expect(
      projectRegistry.registerProject("my-project", ["bob"])
    ).to.be.revertedWith("ChainVouch: Project already registered");
  });

  it("getMaintainers should return the initial maintainer list", async function () {
    const { projectRegistry } = await deploy();

    await projectRegistry.registerProject("my-project", ["alice", "bob", "carol"]);

    const maintainers = await projectRegistry.getMaintainers("my-project");
    expect(maintainers).to.deep.equal(["alice", "bob", "carol"]);
  });

  it("updateMaintainers should succeed when called by the registering address", async function () {
    const { projectRegistry } = await deploy();

    await projectRegistry.registerProject("my-project", ["alice"]);

    await expect(
      projectRegistry.updateMaintainers("my-project", ["alice", "bob"], "0x00")
    ).to.emit(projectRegistry, "MaintainersUpdated");

    const maintainers = await projectRegistry.getMaintainers("my-project");
    expect(maintainers).to.deep.equal(["alice", "bob"]);
  });

  it("updateMaintainers should revert when called by an unauthorized address", async function () {
    const { projectRegistry, other } = await deploy();

    await projectRegistry.registerProject("my-project", ["alice"]);

    await expect(
      projectRegistry.connect(other).updateMaintainers("my-project", ["eve"], "0x00")
    ).to.be.revertedWith("ChainVouch: Caller is not an authorized maintainer");
  });

  it("updateMaintainers should revert for an unregistered project", async function () {
    const { projectRegistry } = await deploy();

    await expect(
      projectRegistry.updateMaintainers("unknown-project", ["alice"], "0x00")
    ).to.be.revertedWith("ChainVouch: Project not registered");
  });
});
