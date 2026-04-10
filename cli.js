import { ethers } from "ethers";
import fs from "fs";
import axios from "axios";
import 'dotenv/config';

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

function loadConfig() { return JSON.parse(fs.readFileSync(CONFIG_PATH)); }

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
    const tx = await vouchLog.recordVouch(projectId, contributor, maintainer, "0x00", type, reason);
    await tx.wait();
    console.log(`✅ ${isDenounce ? 'Denouncement' : 'Vouch'} Recorded!`);
}

async function endorse(source, target, maintainer) {
    const config = loadConfig();
    const endorseLog = await getContract(config.endorseLogAddress, ENDORSE_ABI, true);
    const tx = await endorseLog.recordEndorsement(source, target, maintainer, "0x00");
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
if (cmd === "register") register(a1, a2);
else if (cmd === "vouch") recordVouchOrDenounce(a1, a2, a3, a4, false);
else if (cmd === "denounce") recordVouchOrDenounce(a1, a2, a3, a4, true);
else if (cmd === "endorse") endorse(a1, a2, a3);
else if (cmd === "check") check(a1);
