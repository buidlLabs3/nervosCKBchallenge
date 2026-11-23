# Campaign 08 proof

Testnet only. Do not include keys, seed phrases, browser storage dumps or
faucet credentials in any capture. The payment hash is public; the preimage is
only shown as "yes (32 bytes)".

## Basic demo — `basic/`

Screenshots and `demo.mp4` for the basic quest flow: two nodes, channels,
liquidity, encrypted offer, lock proof, payment receipt, decrypted result.

| File | What it shows |
| --- | --- |
| `0.png` / `1.png` | Cards before and after starting both nodes |
| `c0.png` / `c1.png` | Channel cards before open and at `CHANNEL_READY` |
| `u0.png` / `u1.png` | Liquidity before and after the 5 CKB transfer |
| `e0.png` | Plaintext, ciphertext and AES-GCM code |
| `a0.png` / `a1.png` | Invoice button and created 1 CKB invoice |
| `d0.png` / `d1.png` | Public offer JSON and the "Decryption rejected" line |
| `w0.png` / `w1.png` | Pay button and completed payment receipt |
| `dr.png` | Preimage revealed and decrypt button |
| `demo.mp4` | Assembled basic demo video |

## Advanced demo — `advance/`

Frames from the advanced pay-to-unlock flow plus `demo.mp4`.

Published video: [youtube.com/watch?v=JO-0Bx1oYIk](https://www.youtube.com/watch?v=JO-0Bx1oYIk)

| File | What it shows |
| --- | --- |
| `a.png` | Both nodes idle — Start buttons, `NOT STARTED` |
| `b.png` | Nodes started — funding addresses and open-channel buttons |
| `c.png` | Funded — on-chain balance 100,000 CKB on both cards |
| `d.png` | Liquidity card before the 5 CKB transfer |
| `d1.png` | Live channel balances after the transfer, Verify-via-RPC |
| `e.png` | `OFFER READY` — ciphertext in the public offer JSON |
| `f.png` | `KEY REVEALED` — rejection without key, then Decrypt lit |
| `g.png` | Payment receipt (`sha256(preimage) = payment hash ✓`) and decrypted result |
| `demo.mp4` | Assembled advanced demo video |

Optional extra evidence: channel funding transaction links on
`pudge.explorer.nervos.org`.
