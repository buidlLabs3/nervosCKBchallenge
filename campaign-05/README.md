# Campaign 05 — Workshop Credits

`buidlLabs3`'s local experiment for the [Create a Fungible Token](https://docs.nervos.org/docs/dapp/create-token) tutorial. The `fungible-demo` app creates a batch of 720 xUDT units, queries live cells with the issuer's Lock Script Hash, and sends 180 units to a second account. The issuer receives 540 units in change.

Workshop Credits / WKC is a display label for this demo. It is not token metadata stored on-chain. The actual token identity is the xUDT Type Script, whose args contain the issuer hash and four zero flag bytes.

## Run

Start the local chain in one terminal:

```sh
offckb node
```

Then open the app in a second terminal:

```sh
cd campaign-05/fungible-demo
npm ci
npm run check
npm run build
npm start
```

Open <http://127.0.0.1:1252/workshop.html>. Run `offckb accounts` and enter a local test key. Create a batch, click **Find token cells**, enter another account's address, and send a portion of the batch. The input is masked, and this app never saves the key.

All transactions use the local OffCKB RPC at `127.0.0.1:28114`. They are committed on that local chain and do not appear in public Testnet or Mainnet explorers. The application deliberately has no public-network setting.

## Reproduce the evidence

With OffCKB running and port 1252 free:

```sh
cd campaign-05/fungible-demo
npx playwright install chromium
npm run proof
```

The runner reads the public development accounts from `offckb accounts`; it uses account slot 12 as issuer and slot 13 as recipient. It starts the actual browser app, clicks create/find/send, checks the raw RPC response, captures two screenshots, and stops its app server. It does not reset OffCKB. Each transfer spends the token cell created by that run, so another run does not combine earlier batches. Existing token cells with the same issuer hash can still appear in the global lookup.

Optional settings are `MAKER_SLOT`, `GUEST_SLOT`, `BATCH_SIZE`, and `SEND_SIZE`. The proof expects a positive partial transfer so both the recipient and change outputs can be verified. New runs replace the generated local proof files.

## Files and behavior

- [`fungible-demo/chain.mjs`](fungible-demo/chain.mjs): local client, positive `uint128` amount checks, issuance, issuer-hash lookup, and spending the current batch with token change.
- [`fungible-demo/workshop.html`](fungible-demo/workshop.html), [`screen.mjs`](fungible-demo/screen.mjs), and [`tone.css`](fungible-demo/tone.css): three-step browser interface with live cell balances and transaction receipts.
- [`fungible-demo/token-flow.mjs`](fungible-demo/token-flow.mjs): browser execution and independent RPC assertions.
- [`proof/README.md`](proof/README.md): transaction hashes, raw evidence, screenshots, and results.
- [`proof/notes.md`](proof/notes.md): prompts for the participant's own reflection.

The implementation follows the official tutorial's xUDT construction and changes the interface, names, account selection, amounts, and proof flow. Required CKB protocol field names and SDK method names retain their standard spelling.
