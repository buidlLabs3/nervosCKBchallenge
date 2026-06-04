# Build on CKB Campaign #01 - Second Submission

This repository contains a separate OffCKB devnet submission for the Build on CKB Campaign #01, using the `buidlLabs3` GitHub account.

## What I Built

The project is `nervos-anchor-quest`, an OffCKB TypeScript contract named `anchor-note`.

The contract accepts exactly one grouped output cell when:

- the output data starts with `CKB_CHALLENGE_ANCHOR_V2`
- the output capacity leaves at least 20 CKB above the cell's occupied capacity

This is intentionally different from the first campaign repo. It creates a marked anchor-note cell on local OffCKB devnet instead of only using the earlier capacity-guard flow.

## Devnet Proof

Network: local OffCKB devnet (`http://127.0.0.1:28114`)

Contract deployment tx:

```text
0x3f337f4b27a1dbf040f1247fa4a5eefe81a986c0ac773dbaf243b0ff57e6e3cc
```

Anchor-note execution tx:

```text
0x5e58f3c9eb5b7c166ddcc4c4075831c564449b247acd15ef93da044c80c25013
```

Deployed contract code hash:

```text
0x414eeca4ee948383ce741516f411ddaf988825c37d4cdff07225d4131aa6f410
```

Proof screenshots and logs are in [`proof/`](proof/README.md).

## Run Locally

```bash
cd nervos-anchor-quest
npm install
npm run build
npm run test:only -- anchor-note.mock.test.ts
npm run deploy -- --yes
PRIVATE_KEY=<local-devnet-key> npm run test:only -- anchor-note.devnet.test.ts
```

Start OffCKB devnet before deploy/test:

```bash
offckb node
```

## Devnet vs Testnet

Devnet here means the local OffCKB chain running on my machine. It is private to the local environment, resets easily, and is meant for fast contract development. Testnet is a shared public CKB network, so public explorers can index it.

Because this was deployed on local OffCKB devnet, the transaction hashes will not show up on mainnet or testnet explorers. The proof is the local RPC confirmation, deployment artifacts, logs, and screenshots in this repo.
