# Campaign 06: Fiber Browser Payments

Local React and TypeScript implementation of the two Fiber browser tutorials.
The app runs a WASM node, connects to a public peer, opens a CKB Testnet
channel, and sends a keysend payment. Use Testnet funds only.

## Run

```sh
npm install
npm run dev
```

Open the localhost URL printed by Next.js. Cross-origin isolation headers are
configured for Fiber WASM. Keep the same browser profile while moving from the
connection tutorial to the payment flow.

## Execution checklist

| Stage | Required state |
| --- | --- |
| Start node | `node_started` and a visible public key |
| Connect peer | `peer_connected`, one public WSS peer |
| Open channel | 499 CKB contribution, then `CHANNEL_READY` |
| Send payment | 1 CKB keysend with `Success` receipt |

The browser captures are [peer-session.png](proof/screenshots/peer-session.png)
and [keysend-receipt.png](proof/screenshots/keysend-receipt.png).

## Source map

| Path | Responsibility |
| --- | --- |
| `app/page.tsx` | Tutorial interface and receipt |
| `app/globals.css` | Dark technical dashboard theme |
| `lib/fiber.ts` | Browser node, identity, peer, and balance integration |
| `lib/use-fiber.ts` | Channel lifecycle, events, and keysend result |
| `lib/amounts.ts` | CKB precision and channel-state helpers |

The channel funding transaction is on-chain. The keysend updates the channel
balance off-chain. [View the committed Testnet transaction](https://pudge.explorer.nervos.org/transaction/0xa9e2bfd985bc52c930a9f1f76abeec3432213c5f6a087bfae16cb7abcf229ed6).

Tutorials: [Connect a WASM node](https://www.fiber.world/docs/build/connect-wasm-node) · [Open a channel and send a payment](https://www.fiber.world/docs/build/open-channel-payment).
