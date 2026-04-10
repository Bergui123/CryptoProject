import { ethers } from "ethers";
import fs from "fs";
import 'dotenv/config';

const CONFIG_PATH = "./.chainvouch_config.json";
// This is the ABI (interface) for the ProjectRegistry contract we compiled earlier
const REGISTRY_ABI = [
    "function registerProject(string memory _projectId, string[] memory _initialMaintainers) public",
    "function getMaintainers(string memory _projectId) public view returns (string[] memory)"
];

function loadConfig() {
    if (fs.existsSync(CONFIG_PATH)) {
        return JSON.parse(fs.readFileSync(CONFIG_PATH));
    }
    return null;
}

function saveConfig(config) {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
}

async function init() {
    console.log("Initializing ChainVouch local environment...");
    const wallet = ethers.Wallet.createRandom();
    const config = {
        walletPrivateKey: wallet.privateKey,
        walletAddress: wallet.address,
        network: "sepolia",
        registryAddress: "" // We will fill this after deployment
    };
    saveConfig(config);
    console.log(`✅ Local environment initialized!\nWallet Address: ${wallet.address}`);
}

async function register(projectId, maintainers) {
    const config = loadConfig();
    if (!config || !config.registryAddress) {
        console.error("Error: Project not initialized or Registry address missing in config.");
        return;
    }

    // Connect to Sepolia (using a public RPC for now)
    const provider = new ethers.JsonRpcProvider("https://rpc.ankr.com/eth_sepolia");
    const wallet = new ethers.Wallet(config.walletPrivateKey, provider);
    const registry = new ethers.Contract(config.registryAddress, REGISTRY_ABI, wallet);

    console.log(`Registering project ${projectId} with maintainers: ${maintainers}...`);
    
    try {
        const tx = await registry.registerProject(projectId, maintainers.split(","));
        console.log(`Transaction sent! Hash: ${tx.hash}`);
        await tx.wait();
        console.log("✅ Project registered successfully on-chain!");
    } catch (error) {
        console.error("Transaction failed:", error.reason || error.message);
    }
}

// Command Router
const [,, command, arg1, arg2] = process.argv;

if (command === "init") {
    init();
} else if (command === "register") {
    if (!arg1 || !arg2) {
        console.log("Usage: node cli.js register <org/repo> <maintainer1,maintainer2>");
    } else {
        register(arg1, arg2);
    }
} else {
    console.log("Usage: node cli.js <command>");
    console.log("Commands: init, register");
}
