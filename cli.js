import { ethers } from "ethers";
import fs from "fs";
import axios from "axios";
import sshpkModule from "sshpk";
import 'dotenv/config';

const sshpk = sshpkModule;

const CONFIG_PATH = "./.chainvouch_config.json";

// Section 4.3: Smart Contract ABIs
const REGISTRY_ABI = ["function registerProject(string _projectId, string[] _maintainers) public", "function getMaintainers(string _projectId) public view returns (string[])"];
const VOUCH_LOG_ABI = [
    "function recordVouch(string _projectId, string _contributor, string _maintainer, bytes _sig, uint8 _type, string _reason) public",
    "function getEventCount() public view returns (uint256)",
    "function vouchEvents(uint256) public view returns (string, string, string, bytes, uint256, uint8, string)",
    "function getVouchesFor(string _projectId, string _contributor) public view returns (tuple(string projectId, string contributor, string maintainer, bytes signature, uint256 timestamp, uint8 eventType, string reason)[])",
    "function getDenouncements(string _projectId, string _contributor) public view returns (tuple(string projectId, string contributor, string maintainer, bytes signature, uint256 timestamp, uint8 eventType, string reason)[])"
];
const ENDORSE_ABI = [
    "function recordEndorsement(string _source, string _target, string _maintainer, bytes _sig) public",
    "function getEndorsementCount() public view returns (uint256)",
    "function endorsements(uint256) public view returns (string, string, string, bytes, uint256)",
    "function getEndorsementsFor(string _projectId) public view returns (tuple(string sourceProjectId, string targetProjectId, string maintainer, bytes signature, uint256 timestamp)[])"
];

async function init() {
    // Generate Ethereum keypair
    const wallet = ethers.Wallet.createRandom();
    let config = {};
    if (fs.existsSync(CONFIG_PATH)) {
        config = JSON.parse(fs.readFileSync(CONFIG_PATH));
    }

    // Generate SSH keypair for signing
    const sshKey = sshpk.generatePrivateKey('ecdsa');
    const sshPrivatePem = sshKey.toString('pkcs8');
    const sshPublicKey = sshKey.toPublic().toString('ssh');

    config.walletAddress = wallet.address;
    config.walletPrivateKey = wallet.privateKey;
    config.sshPrivateKey = sshPrivatePem;
    config.sshPublicKey = sshPublicKey;

    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));

    console.log("ChainVouch initialized.");
    console.log(`Wallet address: ${wallet.address}`);
    console.log(`SSH public key: ${sshPublicKey}`);
    console.log("");
    console.log("Next steps:");
    console.log("  1. Fund your wallet with Sepolia ETH: https://sepoliafaucet.com");
    console.log("  2. Add contract addresses to .chainvouch_config.json");
    console.log("  3. Run: node cli.js register <projectId> <maintainer1,...>");
}

function signPayload(config, payload) {
    if (!config.sshPrivateKey) return "0x00";
    const key = sshpk.parseKey(config.sshPrivateKey, 'pkcs8');
    const signer = key.createSign('sha256');
    signer.update(payload);
    const sig = signer.sign();
    return "0x" + sig.toBuffer().toString("hex");
}

function loadConfig() {
    if (!fs.existsSync(CONFIG_PATH)) {
        console.log("No config found — skipping check (UNVERIFIED)");
        process.exit(2);
    }
    return JSON.parse(fs.readFileSync(CONFIG_PATH));
}

async function getContract(address, abi, withSigner = false) {
    const config = loadConfig();
    const provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");
    if (!withSigner) return new ethers.Contract(address, abi, provider);
    const wallet = new ethers.Wallet(config.walletPrivateKey, provider);
    return new ethers.Contract(address, abi, wallet);
}

// Section 4.2: Identity Oracle - Fetch Keys from GitHub
async function verifyGitHubIdentity(username) {
    try {
        const response = await axios.get(`https://github.com/${username}.keys`);
        return response.data.split('\n').filter(k => k.trim().length > 0);
    } catch (e) { return []; }
}

async function register(projectId, maintainers) {
    const config = loadConfig();
    const registry = await getContract(config.registryAddress, REGISTRY_ABI, true);
    console.log(`📡 Registering ${projectId}...`);
    const tx = await registry.registerProject(projectId, maintainers.split(","));
    await tx.wait();
    console.log("✅ Project Registered!");
}

async function recordVouchOrDenounce(projectId, contributor, maintainer, reason, isDenounce = false) {
    // 4.2 Verification
    const keys = await verifyGitHubIdentity(maintainer);
    if (keys.length === 0) return console.error("❌ Invalid Maintainer Identity");

    const config = loadConfig();
    const vouchLog = await getContract(config.vouchLogAddress, VOUCH_LOG_ABI, true);
    const type = isDenounce ? 1 : 0;
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const payload = [projectId, contributor, maintainer, timestamp].join(":");
    const sig = signPayload(config, payload);
    const tx = await vouchLog.recordVouch(projectId, contributor, maintainer, sig, type, reason);
    await tx.wait();
    console.log(`✅ ${isDenounce ? 'Denouncement' : 'Vouch'} Recorded!`);
}

async function endorse(source, target, maintainer) {
    const config = loadConfig();
    const endorseLog = await getContract(config.endorseLogAddress, ENDORSE_ABI, true);
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const payload = [source, target, maintainer, timestamp].join(":");
    const sig = signPayload(config, payload);
    const tx = await endorseLog.recordEndorsement(source, target, maintainer, sig);
    await tx.wait();
    console.log(`✅ Endorsement from ${source} to ${target} Recorded!`);
}

// Section 4.4: Trust Score Math (S(c) = Σ (1 + E(p)))
async function check(contributor) {
    const config = loadConfig();
    const vouchLog = await getContract(config.vouchLogAddress, VOUCH_LOG_ABI);
    const endorseLog = await getContract(config.endorseLogAddress, ENDORSE_ABI);

    const vCount = await vouchLog.getEventCount();
    let score = 0;
    let badFlag = false;

    // Collect unique projectIds that have vouched for this contributor
    const projectIds = new Set();
    for (let i = 0; i < vCount; i++) {
        const v = await vouchLog.vouchEvents(i);
        if (v[1].toLowerCase() === contributor.toLowerCase()) {
            projectIds.add(v[0]);
        }
    }

    for (const projectId of projectIds) {
        const vouches = await vouchLog.getVouchesFor(projectId, contributor);
        const denouncements = await vouchLog.getDenouncements(projectId, contributor);

        if (denouncements.length > 0) badFlag = true;

        if (vouches.length > 0) {
            const endorsements = await endorseLog.getEndorsementsFor(projectId);
            const weight = 1 + endorsements.length;
            score += weight;
            console.log(`🔍 Vouch: ${projectId} (Weight: ${weight})`);
        }
    }

    console.log(`--- Result for ${contributor} ---`);
    if (badFlag) {
        console.log("🚨 STATUS: DENOUNCED (DO NOT MERGE)");
        process.exit(1);
    } else if (score < 2) {
        console.log(`Trust Score: ${score} | Status: UNVERIFIED`);
        process.exit(2);
    } else {
        console.log(`Trust Score: ${score} | Status: TRUSTED`);
        process.exit(0);
    }
}

const [,, cmd, a1, a2, a3, a4] = process.argv;
if (cmd === "init") init();
else if (cmd === "register") register(a1, a2);
else if (cmd === "vouch") recordVouchOrDenounce(a1, a2, a3, a4, false);
else if (cmd === "denounce") recordVouchOrDenounce(a1, a2, a3, a4, true);
else if (cmd === "endorse") endorse(a1, a2, a3);
else if (cmd === "check") check(a1);
