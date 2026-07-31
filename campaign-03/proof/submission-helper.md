# Campaign 03 Submission Helper

## Main Proof Link

After publication:

https://github.com/buidlLabs3/nervosCKBchallenge/tree/main/campaign-03/proof

## Direct Links

- Contract source:
  https://github.com/buidlLabs3/nervosCKBchallenge/blob/main/campaign-03/simple-lock-lab/contracts/hash-lock/src/index.ts
- Deployment proof:
  https://github.com/buidlLabs3/nervosCKBchallenge/blob/main/campaign-03/proof/screenshots/03-deployment-and-rpc.png
- Funded frontend:
  https://github.com/buidlLabs3/nervosCKBchallenge/blob/main/campaign-03/proof/screenshots/04-funded-workbench.png
- Rejected witness:
  https://github.com/buidlLabs3/nervosCKBchallenge/blob/main/campaign-03/proof/screenshots/05-wrong-witness-rejected.png
- Committed unlock:
  https://github.com/buidlLabs3/nervosCKBchallenge/blob/main/campaign-03/proof/screenshots/06-correct-witness-committed.png
- Capacity-aware retry:
  https://github.com/buidlLabs3/nervosCKBchallenge/blob/main/campaign-03/proof/screenshots/08-capacity-aware-retry.png
- Raw RPC evidence:
  https://github.com/buidlLabs3/nervosCKBchallenge/blob/main/campaign-03/proof/rpc-evidence.json

## Ready-to-Copy Technical Response

```markdown
I completed the official Build a Simple Lock tutorial on an OffCKB local devnet. Full proof package:
https://github.com/buidlLabs3/nervosCKBchallenge/tree/main/campaign-03/proof

Steps completed:

1. Set up OffCKB 0.4.6 and confirmed the local RPC at http://127.0.0.1:28114.
   Proof: https://github.com/buidlLabs3/nervosCKBchallenge/blob/main/campaign-03/proof/screenshots/01-offckb-environment.png

2. Built a custom hash-lock contract and tested matching, mismatching, empty, and malformed inputs in the CKB VM.
   Source: https://github.com/buidlLabs3/nervosCKBchallenge/blob/main/campaign-03/simple-lock-lab/contracts/hash-lock/src/index.ts
   Proof: https://github.com/buidlLabs3/nervosCKBchallenge/blob/main/campaign-03/proof/screenshots/02-contract-build-and-tests.png

3. Deployed the bytecode to OffCKB. Deployment transaction: 0x7ed208e44b0b25b85a23b006f496b3ff7d33aa14a8dfcece46c30e8dda4f48dc. Code hash: 0x63c11017f2fc6a559b59d9965bb650a5e823c84da4fe0f29bec2e4e1f43c88ce.
   Proof: https://github.com/buidlLabs3/nervosCKBchallenge/blob/main/campaign-03/proof/screenshots/03-deployment-and-rpc.png

4. Production-built the required Witness Relay frontend and deposited 300 CKB into its derived hash-lock address. Deposit transaction: 0xeec534f55257885b37ff882aa47177e224c9fbfedacfd5ef898cbab9b1a9dc43.
   Proof: https://github.com/buidlLabs3/nervosCKBchallenge/blob/main/campaign-03/proof/screenshots/04-funded-workbench.png

5. Submitted an incorrect witness from the frontend. The custom contract rejected it with exit code 11, and the 300 CKB cell remained live.
   Proof: https://github.com/buidlLabs3/nervosCKBchallenge/blob/main/campaign-03/proof/screenshots/05-wrong-witness-rejected.png

6. Submitted the matching witness from the frontend and waited for commitment. Unlock transaction: 0xc40a60c7556272b5cd79d9de13e9dda9b43bb7b5eb2b9f7401b8fe9075399dea. It sent 99 CKB to the recipient, created 200.99999 CKB of hash-lock change, and paid a 0.00001 CKB fee.
   Desktop proof: https://github.com/buidlLabs3/nervosCKBchallenge/blob/main/campaign-03/proof/screenshots/06-correct-witness-committed.png
   Mobile proof: https://github.com/buidlLabs3/nervosCKBchallenge/blob/main/campaign-03/proof/screenshots/07-mobile-committed.png

The original 300 CKB output is spent and both unlock outputs are live. The checked-in raw RPC snapshot plus an offline verifier checks 47 transaction, bytecode, witness, capacity, fee, lock, and live-cell invariants:
https://github.com/buidlLabs3/nervosCKBchallenge/blob/main/campaign-03/proof/rpc-evidence.json

I also reproduced the post-unlock 200.99999 CKB state. The frontend calculates a 92.99998 CKB maximum so it can retain the 108 CKB occupied-capacity floor and fee, then the mismatch reaches the intended contract rejection:
https://github.com/buidlLabs3/nervosCKBchallenge/blob/main/campaign-03/proof/screenshots/08-capacity-aware-retry.png
```

## Before Submission

- Confirm eligibility as a new CKB builder.
- Confirm membership in the Build on CKB Telegram group.
- Run `pnpm verify:submission` from `campaign-03/simple-lock-lab`.
- Open every published proof link after the owner approves a GitHub push.
- Write the reflection personally using the factual notes, not generated prose.
- Submit before the CKBoost deadline.

The chain is private OffCKB devnet. Do not add public explorer links for these
transactions; use the included RPC evidence, logs, screenshots, and verifier.
