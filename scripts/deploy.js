import { ethers } from "ethers";
import fs from "fs";

// Load artifacts manually from the build folder
const ProjectRegistryArtifact = JSON.parse(fs.readFileSync("./artifacts/contracts/ProjectRegistry.sol/ProjectRegistry.json"));
const VouchLogArtifact = JSON.parse(fs.readFileSync("./artifacts/contracts/VouchLog.sol/VouchLog.json"));
const EndorsementLogArtifact = JSON.parse(fs.readFileSync("./artifacts/contracts/EndorsementLog.sol/EndorsementLog.json"));

async function deployContract(name, artifact, signer) {
    const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, signer);
    const contract = await factory.deploy();
    await contract.waitForDeployment();
    const address = await contract.getAddress();
    console.log(`${name} deployed to: ${address}`);
    return address;
}

async function main() {
    // Connect to the local Hardhat node you just started
    const provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");
    
    // Get the first account from the 'Accounts' list in your other terminal
    const signer = await provider.getSigner(0);

    console.log("Deploying ChainVouch contracts to local node...");

    const registryAddr = await deployContract("ProjectRegistry", ProjectRegistryArtifact, signer);
    const vouchAddr = await deployContract("VouchLog", VouchLogArtifact, signer);
    const endorseAddr = await deployContract("EndorsementLog", EndorsementLogArtifact, signer);

    console.log("\n--- CONFIGURATION UPDATE ---");
    console.log("Please update your .chainvouch_config.json with the ProjectRegistry address.");
}

main().catch((error) => {
    console.error("Deployment failed:", error);
    process.exit(1);
});
