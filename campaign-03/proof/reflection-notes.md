# Personal Reflection Notes

Do not submit this file as the reflection. Use only the moments that genuinely
match your experience and write the final response yourself.

## Concrete Process Moments

- `pnpm deploy` invoked pnpm's workspace deployment command instead of the
  package script. The unambiguous form was `pnpm run deploy`.
- The imported deployment wrapper silently dropped OffCKB's `--yes` flag. After
  checking `offckb deploy --help`, the wrapper was updated to parse and forward
  the supported option.
- The production build exposed mismatched Next.js and `eslint-config-next`
  versions. Pinning both to `15.5.18` restored compile, lint, type validation,
  static generation, and tracing.
- The wrong witness was more useful than a happy-path-only demo: the node
  returned exit code 11 and the UI confirmed that the 300 CKB cell stayed live.
- The frontend did not call an action complete when it received a hash. It
  waited for `committed`, refreshed RPC state, and displayed the resulting
  hash-lock change.

## CKB Concepts Worth Explaining Personally

- Unlocking consumes the deposit cell and creates new recipient/change cells;
  it does not edit a balance in place.
- A local transaction hash is weak evidence for an external reviewer unless
  the relevant RPC state is made portable.
- The tutorial hash lock reveals its preimage in the witness. A miner can
  front-run a pending transaction, and any remaining change under the same lock
  becomes spendable after disclosure.
- Practical improvements include binding the spend to an owner signature,
  moving change to a fresh lock, using a one-time high-entropy preimage, and
  adding a timeout/recovery path.

## Strong Reflection Shape

1. Start with one exact expectation that turned out to be wrong.
2. Describe one command, RPC state, or UI result you personally checked.
3. Explain what that changed in your understanding of CKB cells or witnesses.
4. End with one design decision you would make differently in a real lock.
