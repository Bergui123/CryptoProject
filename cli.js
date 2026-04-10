import { ethers } from "ethers";
import fs from "fs";
import axios from "axios";
import 'dotenv/config';

const CONFIG_PATH = "./.chainvouch_config.json";

// Section 4.3: Smart Contract ABIs
const REGISTRY_ABI = ["function registerProject(string _projectId, string[] _maintainers) public", "function getMaintainers(string _projectId) public view returns (string[])"];
const VOUCH_LOG_ABI = ["function recordVouch(string _projectId, string _contributor, string _maintainer, bytes _sig, uint8 _type, string _reason) public", "function getEventCount() public view returns (uint256)", "function vouchEvents(uint256) public view returns (string, string, string, bytes, uint256, uint8, string)"];
const ENDORSE_ABI = ["function recordEndorsement(string _source, string _target, string _maintainer, bytes _sig) public", "function getEndorsementCount() public view returns (uint256)", "function endorsements(uint256) public view returns (string, string, string, bytes, uint256)"];

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

    const vouchLog = await getContract("0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512", VOUCH_LOG_ABI, true);
    const type = isDenounce ? 1 : 0;
    const tx = await vouchLog.recordVouch(projectId, contributor, maintainer, "0x00", type, reason);
    await tx.wait();
    console.log(`✅ ${isDenounce ? 'Denouncement' : 'Vouch'} Recorded!`);
}

async function endorse(source, target, maintainer) {
    const endorseLog = await getContract("0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0", ENDORSE_ABI, true);
    const tx = await endorseLog.recordEndorsement(source, target, maintainer, "0x00");
    await tx.wait();
    console.log(`✅ Endorsement from ${source} to ${target} Recorded!`);
}

// Section 4.4: Trust Score Math (S(c) = Σ (1 + E(p)))
async function check(contributor) {
    const vouchLog = await getContract("0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512", VOUCH_LOG_ABI);
    const endorseLog = await getContract("0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0", ENDORSE_ABI);
    
    const vCount = await vouchLog.getEventCount();
    const eCount = await endorseLog.getEndorsementCount();
    let score = 0;
    let badFlag = false;

    for (let i = 0; i < vCount; i++) {
        const v = await vouchLog.vouchEvents(i);
        if (v[1].toLowerCase() === contributor.toLowerCase()) {
            if (Number(v[5]) === 1) badFlag = true;
            let weight = 1;
            for (let j = 0; j < eCount; j++) {
                const e = await endorseLog.endorsements(j);
                if (e[1] === v[0]) weight++;
            }
            score += weight;
            console.log(`🔍 Vouch: ${v[0]} (Weight: ${weight})`);
        }
    }

    console.log(`--- Result for ${contributor} ---`);
    if (badFlag) console.log("🚨 STATUS: DENOUNCED (DO NOT MERGE)");
    else console.log(`Trust Score: ${score} | Status: ${score >= 2 ? "TRUSTED" : "UNVERIFIED"}`);
}

const [,, cmd, a1, a2, a3, a4] = process.argv;
if (cmd === "register") register(a1, a2);
else if (cmd === "vouch") recordVouchOrDenounce(a1, a2, a3, a4, false);
else if (cmd === "denounce") recordVouchOrDenounce(a1, a2, a3, a4, true);
else if (cmd === "endorse") endorse(a1, a2, a3);
else if (cmd === "check") check(a1);
