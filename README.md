# ChainVouch

A decentralized trust and reputation system for GitHub projects, built on Ethereum. Maintainers vouch for or denounce contributors on-chain; trust scores are weighted by project-to-project endorsements.

---

## How it works

- **Vouches** — a project maintainer records a vouch for a contributor. Each vouch adds 1 × the project's endorsement weight to the contributor's trust score.
- **Denouncements** — a single denouncement marks the contributor as DENOUNCED regardless of score.
- **Endorsements** — project A endorses project B, increasing the weight of B's vouches by 1.
- **Trust score** — `S(c) = Σ (1 + E(p))` where `E(p)` is the number of endorsements targeting project `p`.

---

## Contracts

| Contract | Purpose |
|---|---|
| `ProjectRegistry` | Registers projects and tracks maintainers |
| `VouchLog` | Records vouches and denouncements |
| `EndorsementLog` | Records project-to-project endorsements |

Local addresses (after `npm run deploy`) are stored in `.chainvouch_config.json`.

---

## Setup

```bash
npm install
```

Start a local Hardhat node:

```bash
npx hardhat node
```

Deploy contracts (in a separate terminal):

```bash
node scripts/deploy.js
```

The deploy script prints the three contract addresses. Add them to `.chainvouch_config.json`:

```json
{
  "walletPrivateKey": "<your-key>",
  "walletAddress": "<your-address>",
  "network": "local",
  "registryAddress": "<ProjectRegistry address>",
  "vouchLogAddress": "<VouchLog address>",
  "endorseLogAddress": "<EndorsementLog address>"
}
```

---

## CLI Commands

```bash
# Register a project with comma-separated maintainer GitHub usernames
node cli.js register <projectId> <maintainer1,maintainer2>

# Vouch for a contributor
node cli.js vouch <projectId> <contributor> <maintainer> <reason>

# Denounce a contributor
node cli.js denounce <projectId> <contributor> <maintainer> <reason>

# Endorse another project
node cli.js endorse <sourceProjectId> <targetProjectId> <maintainer>

# Check a contributor's trust score
# Exit codes: 0 = TRUSTED, 1 = DENOUNCED, 2 = UNVERIFIED
node cli.js check <contributor>
```

---

## GitHub Actions

| Workflow | Trigger | Purpose |
|---|---|---|
| `chainvouch-check.yml` | `pull_request` | Checks the PR author's trust score; fails CI if DENOUNCED or UNVERIFIED |
| `vouch-management.yml` | `issue_comment` | Parses `/vouch`, `/denounce`, `/unvouch` commands and submits on-chain transactions |

---

## Running Tests

```bash
npm test
```

---

## Trust Score Formula

```
S(c) = Σ_{p : p vouched for c} (1 + E(p))
```

where `E(p)` = number of endorsements targeting project `p`.

A contributor is considered **TRUSTED** when `S(c) ≥ 2`.
