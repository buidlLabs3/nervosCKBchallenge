# Proof of Deployment

This folder contains the proof artifacts for the second Build on CKB Campaign #01 submission.

## Summary

- OffCKB version: `0.4.6`
- Network: local OffCKB devnet RPC proxy at `http://127.0.0.1:28114`
- Contract: `anchor-note.bc`
- Deployment tx: `0x3f337f4b27a1dbf040f1247fa4a5eefe81a986c0ac773dbaf243b0ff57e6e3cc`
- Anchor-note execution tx: `0x5e58f3c9eb5b7c166ddcc4c4075831c564449b247acd15ef93da044c80c25013`
- Code hash: `0x414eeca4ee948383ce741516f411ddaf988825c37d4cdff07225d4131aa6f410`
- Marker data: `CKB_CHALLENGE_ANCHOR_V2-second-repo-devnet-proof`

## Screenshots

1. [OffCKB installed](screenshots/01-offckb-version.png)
2. [Devnet RPC responding](screenshots/02-devnet-rpc-tip.png)
3. [Build anchor-note bytecode](screenshots/03-build-anchor-note.png)
4. [Mock verifier execution](screenshots/04-mock-anchor-note.png)
5. [Deploy to local devnet](screenshots/05-deploy-devnet.png)
6. [Send anchor-note devnet transaction](screenshots/06-devnet-anchor-transaction.png)
7. [RPC confirmation](screenshots/07-rpc-confirmation.png)

## Logs and RPC Files

- [`logs/01-offckb-version.log`](logs/01-offckb-version.log)
- [`logs/02-devnet-rpc-tip.log`](logs/02-devnet-rpc-tip.log)
- [`logs/03-build-anchor-note.log`](logs/03-build-anchor-note.log)
- [`logs/03-mock-anchor-note.log`](logs/03-mock-anchor-note.log)
- [`logs/04-deploy-devnet.log`](logs/04-deploy-devnet.log)
- [`logs/05-devnet-anchor-transaction.log`](logs/05-devnet-anchor-transaction.log)
- [`logs/06-rpc-confirmation.log`](logs/06-rpc-confirmation.log)
- [`devnet-deployment-final.json`](devnet-deployment-final.json)
- [`devnet-anchor-final.json`](devnet-anchor-final.json)

## Explorer Note

These hashes are for local OffCKB devnet. They are not expected to appear on public mainnet or testnet explorers, because a local devnet is not a public indexed chain.
