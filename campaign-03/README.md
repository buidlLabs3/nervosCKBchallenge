# Build on CKB Campaign #03

This package completes the official
[Build a Simple Lock](https://docs.nervos.org/docs/dapp/simple-lock) tutorial on
an OffCKB local devnet for the `buidlLabs3` account.

The required frontend is included as **Witness Relay**, a focused cell-lifecycle
workbench for deriving the hash lock, observing its funded capacity, testing a
rejected witness, and committing a valid unlock. No unrelated webview or
landing-page features were added.

## Package

- [Contract and frontend](simple-lock-lab/README.md)
- [Proof index](proof/README.md)
- [Submission helper](proof/submission-helper.md)

## Verified Result

- Network: OffCKB local devnet
- RPC: `http://127.0.0.1:28114`
- Contract code hash:
  `0x63c11017f2fc6a559b59d9965bb650a5e823c84da4fe0f29bec2e4e1f43c88ce`
- Deployment transaction:
  `0x7ed208e44b0b25b85a23b006f496b3ff7d33aa14a8dfcece46c30e8dda4f48dc`
- 300 CKB deposit transaction:
  `0xeec534f55257885b37ff882aa47177e224c9fbfedacfd5ef898cbab9b1a9dc43`
- Frontend unlock transaction:
  `0xc40a60c7556272b5cd79d9de13e9dda9b43bb7b5eb2b9f7401b8fe9075399dea`
- Wrong witness: rejected with contract exit code `11`
- Unlock outputs: `99 CKB` recipient and `200.99999 CKB` hash-lock change
- Fee: `0.00001 CKB`
- Portable verification: `47` independent invariants

## Reviewer Check

```bash
cd campaign-03/simple-lock-lab
pnpm install
pnpm verify:submission
```

The transactions belong to a private local chain and will not resolve on a
public explorer. Raw RPC responses and the no-RPC verifier are included in the
[proof package](proof/README.md).

The final campaign reflection is intentionally left for the participant to
write personally.
