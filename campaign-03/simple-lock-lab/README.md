# Witness Relay

Witness Relay is the Campaign 03 implementation of the official
[Build a Simple Lock](https://docs.nervos.org/docs/dapp/simple-lock) tutorial.
It deploys a custom `hash_lock` to OffCKB, funds that lock, and uses a focused
Next.js frontend to demonstrate both a rejected witness and a committed unlock.

The frontend is deliberately limited to the tutorial's required cell lifecycle:
derive a lock, observe its capacity, prepare an OffCKB deposit, and unlock CKB.
It does not place a private key in the browser.

## Verified Devnet Result

| Fact          | Value                                                                |
| ------------- | -------------------------------------------------------------------- |
| Network       | OffCKB local devnet (`http://127.0.0.1:28114`)                       |
| Deployment    | `0x7ed208e44b0b25b85a23b006f496b3ff7d33aa14a8dfcece46c30e8dda4f48dc` |
| Code hash     | `0x63c11017f2fc6a559b59d9965bb650a5e823c84da4fe0f29bec2e4e1f43c88ce` |
| Deposit       | `0xeec534f55257885b37ff882aa47177e224c9fbfedacfd5ef898cbab9b1a9dc43` |
| Unlock        | `0xc40a60c7556272b5cd79d9de13e9dda9b43bb7b5eb2b9f7401b8fe9075399dea` |
| Wrong witness | Rejected by the contract with exit code `11`                         |
| Transfer      | `99 CKB` to recipient                                                |
| Change        | `200.99999 CKB` remains under the hash lock                          |
| Fee           | `0.00001 CKB`                                                        |

The transaction builder reserves the exact occupied capacity of the next
hash-lock change cell plus the fee. After the first unlock, `200.99999 CKB`
remains; the UI therefore adjusts the next maximum from `99` to `92.99998 CKB`
so the `108 CKB` change cell remains valid.

The [proof package](../proof/README.md) connects those claims to screenshots,
raw RPC records, logs, deployment artifacts, and a 47-invariant verifier.

## Contract Behavior

The script reads `WitnessArgs.lock`, hashes its bytes with CKB Blake2b-256, and
compares the result to the final 32 bytes of the running script's arguments.
It uses distinct exit codes so failures are diagnosable:

| Exit | Meaning                                       |
| ---- | --------------------------------------------- |
| `0`  | Witness preimage matches                      |
| `10` | Witness preimage is missing or empty          |
| `11` | Witness hash does not match the lock argument |
| `12` | Script arguments are malformed                |

The isolated VM suite covers all four outcomes. The devnet flow separately
proves that OffCKB rejects the wrong witness and commits the matching one.

## Reproduce

Prerequisites: Node.js 22, pnpm 10, OffCKB 0.4.6, and a running local node.

```bash
offckb node
cd campaign-03/simple-lock-lab
pnpm install
pnpm build
pnpm test:mock
pnpm run deploy -- --yes
```

The deployment wrapper forwards flags to `offckb deploy`. Use `pnpm run deploy`,
not `pnpm deploy`, because the latter is pnpm's workspace deployment command.

Sync the generated deployment metadata into the frontend, then run it:

```bash
cp deployment/scripts.json frontend/deployment/scripts.json
pnpm --dir frontend typecheck
pnpm --dir frontend build
pnpm --dir frontend start
```

Fund the derived address with the exact `offckb transfer` command shown by the
frontend. Submit a mismatching witness first, then the matching preimage. The UI
waits for commitment and refreshes the remaining live capacity.

## Reviewer Commands

The portable check does not require this private devnet:

```bash
CKB_RPC_URL=http://127.0.0.1:1 pnpm verify:offline
pnpm verify:integrity
```

With the original OffCKB chain running, compare the snapshot to live RPC:

```bash
pnpm verify:online
```

Run the complete build, VM, frontend, offline-proof, and integrity gate:

```bash
pnpm verify:submission
```

## Layout

- `contracts/hash-lock/src/index.ts`: custom lock implementation
- `tests/hash-lock.mock.test.ts`: isolated CKB VM outcomes
- `frontend/app/`: required dApp frontend
- `deployment/`: committed OffCKB deployment metadata
- `dist/hash-lock.bc`: exact deployed bytecode
- `scripts/campaign-03-proof-core.mjs`: shared online/offline verifier
- `../proof/`: screenshots, raw evidence, results, and logs
- `UPSTREAM.md`: official source and pinned revision

## Security Boundary

This tutorial lock proves knowledge of a reusable preimage; it does not prove
who supplied it. Once revealed in a transaction, that preimage becomes public,
and a pending transaction can be copied or redirected if the contract does not
bind the witness to the intended transaction. Production designs should use a
fresh secret per lock and bind authorization to transaction context, or use a
signature-based lock when identity and replay resistance are required.
