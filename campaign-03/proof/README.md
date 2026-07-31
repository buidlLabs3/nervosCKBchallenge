# Campaign 03 Proof

This package proves a custom lock deployment and a frontend-driven transfer
from that lock on OffCKB local devnet.

## Requirement Map

| Campaign requirement           | Evidence                                                                   |
| ------------------------------ | -------------------------------------------------------------------------- |
| OffCKB running                 | Environment log and screenshot 01                                          |
| Custom lock built and deployed | Source, bytecode, four VM outcomes, deployment metadata, screenshots 02-03 |
| Required dApp frontend         | Production build and Witness Relay desktop/mobile captures                 |
| Tokens placed under the lock   | Committed 300 CKB deposit and screenshot 04                                |
| Incorrect witness tested       | Node rejection with exit code 11 and screenshot 05                         |
| Tokens unlocked                | Committed frontend transaction and screenshots 06-07                       |
| Reviewer-verifiable result     | Raw RPC snapshot, 47-invariant offline verifier, SHA-256 manifest          |

## Transaction Ledger

### Deployment

- Transaction:
  `0x7ed208e44b0b25b85a23b006f496b3ff7d33aa14a8dfcece46c30e8dda4f48dc`
- Status: `committed` at block `0x3ce4`
- Code hash:
  `0x63c11017f2fc6a559b59d9965bb650a5e823c84da4fe0f29bec2e4e1f43c88ce`
- Bytecode SHA-256:
  `22c8820bce3a954378689f9985a869949ba62ce851d3f2844da3321dd5f829d2`
- [Contract source](../simple-lock-lab/contracts/hash-lock/src/index.ts)
- [Deployment metadata](../simple-lock-lab/deployment/scripts.json)

The verifier recomputes the CKB hash of the checked-in bytecode and requires
the bytecode to match deployment output `0` exactly.

### Deposit

- Preimage: `amber vault opens at sunrise`
- CKB Blake2b-256:
  `0x973a9ff914eb6aedc1e22deb031de440130f54201b9ec2d3ef54adb690cef700`
- Capacity: `300 CKB`
- Transaction:
  `0xeec534f55257885b37ff882aa47177e224c9fbfedacfd5ef898cbab9b1a9dc43`
- Output: `0`
- Status: `committed` at block `0x3d5a`

### Frontend Attempts

The production frontend first submitted `amber vault opens at sunset`. The node
rejected it with contract exit code `11`; the 300 CKB cell remained live.

The matching witness then committed:

- Transaction:
  `0xc40a60c7556272b5cd79d9de13e9dda9b43bb7b5eb2b9f7401b8fe9075399dea`
- Status: `committed` at block `0x3d71`
- Input: deposit transaction output `0`
- Recipient: `99 CKB`, live
- Hash-lock change: `200.99999 CKB`, live
- Fee: `0.00001 CKB`
- Witness: canonical `WitnessArgs.lock` containing the UTF-8 preimage

After commitment, the original deposit output reports `unknown`, proving it was
consumed, while both new outputs report `live`.

## Screenshots

1. [OffCKB environment](screenshots/01-offckb-environment.png)
2. [Contract build and VM outcomes](screenshots/02-contract-build-and-tests.png)
3. [Deployment and RPC verification](screenshots/03-deployment-and-rpc.png)
4. [Funded Witness Relay frontend](screenshots/04-funded-workbench.png)
5. [Wrong witness rejected](screenshots/05-wrong-witness-rejected.png)
6. [Correct witness committed](screenshots/06-correct-witness-committed.png)
7. [Mobile committed state](screenshots/07-mobile-committed.png)
8. [Capacity-aware retry](screenshots/08-capacity-aware-retry.png)

The retry capture reproduces the reported `200.99999 CKB` state. Instead of
failing transaction construction at `99 CKB`, the corrected frontend computes
a `92.99998 CKB` maximum, preserves the `108 CKB` change floor plus fee, and
reaches the intended exit-code-`11` mismatch test.

[Screenshot provenance](screenshots/README.md) documents how every image was
created and which claim it supports.

## Raw Logs

- [Environment](logs/01-environment.log)
- [Contract build](logs/02-contract-build.log)
- [Four VM outcomes](logs/03-contract-vm-tests.log)
- [Frontend typecheck](logs/03-frontend-typecheck.log)
- [Frontend production build](logs/03-frontend-production-build.log)
- [Deployment, including the pnpm wrapper debugging](logs/04-contract-deployment.log)
- [OffCKB deposit](logs/05-hash-lock-deposit.log)
- [Online RPC proof](logs/06-rpc-proof-verification.log)
- [Offline proof with an unusable RPC URL](logs/07-offline-proof-verification.log)
- [Complete reviewer command](logs/08-complete-reviewer-check.log)

## Portable Verification

[rpc-evidence.json](rpc-evidence.json) preserves the raw `get_transaction` and
`get_live_cell` results. [campaign-03-result.json](campaign-03-result.json) is
the concise machine-readable ledger.

```bash
cd campaign-03/simple-lock-lab
CKB_RPC_URL=http://127.0.0.1:1 pnpm verify:offline
pnpm verify:integrity
```

The offline verifier checks 47 independent facts covering transaction hashes,
deployment bytecode, script arguments, witness encoding, capacities, fee,
address locks, the spent deposit, and both live result cells. `SHA256SUMS`
covers the implementation and proof artifacts.

## Network Scope

These hashes belong to a private OffCKB chain. Public CKB explorers cannot see
them, so the raw RPC records and portable verifier are the authoritative proof.

## Reflection Boundary

No final reflection is included. [Reflection notes](reflection-notes.md) record
real debugging moments and technical prompts for the participant to rewrite in
their own voice.
