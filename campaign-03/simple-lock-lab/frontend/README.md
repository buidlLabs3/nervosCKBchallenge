# Witness Relay Frontend

This is the required dApp frontend for Campaign 03. It provides one operational
flow for the custom hash lock:

1. Derive the lock argument and CKB address from a preimage.
2. Query the live capacity held by that lock.
3. Copy the exact OffCKB command needed to deposit CKB.
4. Build an unlock transaction with a chosen witness.
5. Show node rejection or wait until the transaction is committed.

The browser does not hold a private key. OffCKB funds the lock from the local
deployer account; the frontend only spends cells whose authorization is the
preimage witness implemented by the custom lock.

## Run

Create the public local configuration:

```bash
cp .env.example .env.local
```

From `campaign-03/simple-lock-lab`:

```bash
pnpm --dir frontend typecheck
pnpm --dir frontend build
pnpm --dir frontend start
```

Open `http://127.0.0.1:3000`. The default configuration targets the OffCKB RPC
at `http://127.0.0.1:28114`.

## Runtime States

- **Match** uses the exact preimage and can commit an unlock.
- **Mismatch** sends a known-wrong witness and should show exit code `11`.
- **Custom** allows a manually entered witness.
- The event ledger distinguishes submitted, rejected, and committed states.
- Capacity is refreshed after commitment so hash-lock change is visible.
- The amount control computes the recipient minimum, the `108 CKB` hash-lock
  change floor, the fixed fee, and a live maximum before enabling submission.
- With `200.99999 CKB` available, the next safe maximum is `92.99998 CKB`.

The production screenshots and RPC-linked results are indexed in
[the proof package](../../proof/README.md).
