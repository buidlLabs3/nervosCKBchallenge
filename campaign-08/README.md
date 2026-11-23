# Campaign 08: Pay to Unlock with Fiber

A browser-only Buyer A and Seller C on CKB Testnet. The seller encrypts a
result with AES-256-GCM and reuses the same 32 bytes as the Fiber Invoice
`payment_preimage`. The offer is public; only settlement reveals the key.

Built from the official `fiber-encrypted-data-payment` starter
(`https://www.fiber.world/downloads/fiber-encrypted-data-payment.zip`) and the
Fiber browser-payment code in `../campaign-06`.

## What changed from the starter

| Area | Starter | Here |
| --- | --- | --- |
| Layout | Single page, shared `lib/` helpers | Same flow, restyled with the campaign-06 dashboard shell and proof markers |
| CKB helpers | Local copies of hex/amount helpers | Reuses `lib/amounts.ts` from campaign 06 (`parseCkb`, `formatCkb`, `channelReady`, `samePublicKey`, `fundingTransaction`) |
| Funding gate | Refuses at exactly 500 CKB | Requires 501 CKB: 500 CKB channel plus 1 CKB on-chain fee buffer, shown live as an `On-chain balance` line under each address |
| Channel open | One `connectPeer` then one `openChannel` | Waits for Bottle's Init message (feature set), then retries handshake-pending failures with a fresh reconnect — no more `feature not found, waiting for peer to send Init message` |
| Feedback | Guard clauses `return` silently; failures only in the top notice | Every guard throws a specific message shown inside the card that was clicked, plus a route-readiness line, step-by-step statuses and a `Working…` state while busy |
| Liquidity card | Static Bottle numbers, truncated hash | Live seller/Bottle channel balances, full payment hash and the fee in both CKB and shannons |
| Verification | No way to check the result | Receipt proves `sha256(preimage) = payment hash` (reproducible with `sha256sum`), each card links its on-chain funding tx and funding address on the Testnet explorer, Check payment status re-queries the node RPC, and the liquidity payment has its own Verify-hash-via-node-RPC button |
| Liquidity transfer | `0x1dcd65000` (80 CKB) labelled "5 CKB" | `0x1dcd6500` (5 CKB), matching the label and tutorial |
| Lock test | Any thrown error counts as a rejected decryption | Only a `DOMException` named `OperationError` counts; other failures surface |
| Key handling | `decryptResult` accepts any key length | Rejects non-32-byte keys before importing |
| Progress cache | Extra profile-key and step helpers | Only offer text, attempted payment hash and lock-test state |
| Storage | Starter keys | `fiber-unlock:*` keys, so a funded campaign-06 node is untouched |
| Tests | Payment guards only | Payment guards plus amounts and AES-GCM round-trip/wrong-key tests |

Kept unchanged from the starter because they are the audited parts: the
invoice/hop-hint shape in `lib/offer.ts`, the pre-submission rejection list and
attempt persistence in `lib/payment-submission.ts`, the Web Locks node session,
and the Testnet CKB Auth cell-dep patch in `lib/fiber-testnet-runtime.ts`.

## Run

Node.js 22.18 or newer.

```sh
npm install
npm run dev
```

Open `http://127.0.0.1:3000` in Chrome. The app needs a secure context,
`SharedArrayBuffer`, Web Locks and cross-origin isolation; `next.config.mjs`
supplies the COOP/COEP headers. Use `localhost`/`127.0.0.1` or HTTPS.

Checks:

```sh
npm run check
npm test
npm run build
```

## Demos

- **Basic demo:** screenshots and video in [proof/basic/](proof/basic/)
- **Advanced demo:** [youtube.com/watch?v=JO-0Bx1oYIk](https://www.youtube.com/watch?v=JO-0Bx1oYIk) — frames and local copy in [proof/advance/](proof/advance/)

## Execution checklist

| Stage | Required state | Proof |
| --- | --- | --- |
| Start both nodes | Two funding addresses, separate identities | — |
| Fund each address | At least 501 Testnet CKB per node; the `On-chain balance` line under each address shows the confirmed amount and re-checks every 15 s | Faucet transactions |
| Open both channels | 500 CKB each, Bottle auto-accept | Both cards show `CHANNEL_READY` |
| Optional liquidity | 5 CKB seller → Bottle keysend | `Success` |
| Create offer | AES-GCM ciphertext + Fibt Invoice for 1 CKB | Public offer JSON |
| Prove the lock | Decrypt without key fails | "Decryption rejected" line |
| Pay | 1 CKB settled through Bottle, fee ≤ 1 CKB | Receipt with payment hash |
| Decrypt | Output equals the seller plaintext | Decrypted result panel |

Basic captures live in `proof/basic/`; advanced-demo frames in
`proof/advance/`. See [proof/README.md](proof/README.md).

## Source map

| Path | Responsibility |
| --- | --- |
| `app/page.tsx` | Two-node interface, proof markers, receipt and result |
| `app/globals.css` | Campaign-06 dashboard theme |
| `lib/fiber.ts` | Role-scoped identities, Bottle handshake wait/retry, 500 CKB channel lifecycle |
| `lib/crypto.ts` | AES-256-GCM encrypt/decrypt, hex helpers |
| `lib/offer.ts` | Offer v2 JSON, Invoice creation, hop hint, strict parser |
| `lib/payment.ts` | Invoice validation, attempt recording, payment submission |
| `lib/payment-submission.ts` | Pre-submission rejections vs. ambiguous failures |
| `lib/fiber-testnet-runtime.ts` | Fiber v0.10.1 Testnet cell-dep patch |
| `lib/node-session.ts` | One runtime per saved node via Web Locks |
| `lib/progress.ts` | Public-only reload state |
| `lib/amounts.ts` | CKB precision and channel-state helpers |
| `lib/testnet-balance.ts` | On-chain Testnet CKB balance via `get_cells_capacity` |
| `lib/channel-funding.ts` | 501 CKB funding guidance and the pre-open balance gate |

## Limits

The preimage proves the key matches the ciphertext, not that the seller's
report is accurate or useful. There is no refund or dispute path: the buyer
decrypts only after a `Success` payment, and an expired Invoice needs a fresh
offer.
