# Workshop Credits proof

Recorded on 2026-09-17 using local OffCKB devnet at `http://127.0.0.1:28114`. These are real transactions on the local chain, not public Testnet or Mainnet transactions.

The app was served at <http://127.0.0.1:1252/workshop.html>. The browser runner entered a local test key, clicked **Create tokens**, passed the issuer Lock Script Hash into **Find token cells**, and clicked **Send from this batch**. It waited for transaction commitment and recorded raw CKB RPC responses.

| Quest step | Recorded result |
| --- | --- |
| Run the dApp | HTTP 200; actual Chromium interactions; no browser runtime errors |
| Create custom xUDT | 720 units in a 16-byte amount field |
| Query by issuer Lock Script Hash | `0x1a357c2198a2ac6e4f514c8b47f502b04cb9d715ec5528a0b3f70df66a7feb6a` |
| Transfer by replacing the Lock Script | 180 units to account 13, 540 units back to issuer account 12 |
| Preserve token identity | Both new outputs keep exactly the same xUDT Type Script |

Create transaction:

```text
0xc325b01fdaf1f4a5685e3912640254a810d05c2c8ab2f8d279820358253cfd49
```

Send transaction:

```text
0x41f8dc6f2eb95b6ddde7644c811d8514e7089513bb37523ebd4e2bfa72557b71
```

xUDT args (issuer hash followed by four zero flag bytes):

```text
0x1a357c2198a2ac6e4f514c8b47f502b04cb9d715ec5528a0b3f70df66a7feb6a00000000
```

The recipient Lock args are `0x7a83042ddabeb27294fe62588df7acc627d4181f`; issuer change uses `0x516932280d5ff3108119fe2361d0868f1998dcc4`.

## Evidence

- [`batch-created.png`](batch-created.png): actual browser screenshot after issuance and the issuer-hash query. It shows the live 720-token cell and create transaction hash.
- [`credits-sent.png`](credits-sent.png): actual browser screenshot after sending, showing the 180/540 split, the two different holder locks, and both transaction hashes. The key field is cleared for this capture.
- [`receipt.json`](receipt.json): addresses, amounts, issuer hash, before/after query cells, assertions, and raw `get_transaction` / `get_live_cell` results.
- [`run.log`](run.log): successful execution transcript.
- [`server.log`](server.log): the local dApp server output.
- [`checks.log`](checks.log): syntax and production-build validation output.
- [`notes.md`](notes.md): prompts for the participant's own reflection; no generated reflection is supplied.

Both screenshots use a 1280 × 1050 browser viewport. They are separate captures of this repo's working app and transactions.

The runner proves that the original token outpoint was an input to the committed send transaction and is no longer live, while both new token outputs are live. This CKB version reports `unknown` for the consumed cell in `get_live_cell`; the committed transaction input provides the positive evidence of consumption.

## Reproduce

Start `offckb node`, then run the following from `campaign-05/fungible-demo` with port 1252 free:

```sh
npm ci
npx playwright install chromium
npm run check
npm run build
npm run proof
```

The default proof uses OffCKB account slots 12 and 13. The browser runner reads those test credentials locally and does not save keys to these evidence files. A repeat run uses the same token identity but spends its own newly issued batch; existing cells may also appear in the lookup. A chain reset makes the old local hashes unavailable, while these saved RPC responses remain a record of this run.

The tutorial work and screenshots are local. No GitHub push or campaign submission was performed. The participant still needs to write their own reflection and decide which evidence to upload.
