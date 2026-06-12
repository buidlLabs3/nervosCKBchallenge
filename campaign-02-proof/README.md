# Campaign 2 Proof

Tutorial completed: [Store Data on Cell](https://docs.nervos.org/docs/dapp/store-data-on-cell)

This proof shows the three required parts of the tutorial:

- Encode and decode a UTF-8 message as hex.
- Build a CCC transaction with the encoded message in `outputsData[0]`.
- Retrieve the live cell by out point and decode the on-chain data back to the original message.

## Result

- Account label: `buidlLabs3`
- Network: local OffCKB devnet
- RPC endpoint used: `http://127.0.0.1:28114`
- Transaction hash: `0x530512a027647413f1630f3807f8a02e4c33a43b99db997885d933ef44abcbe4`
- Out point: `0x530512a027647413f1630f3807f8a02e4c33a43b99db997885d933ef44abcbe4:0x0`
- Transaction status: `committed`
- Block number: `0x1929`
- Live cell status: `live`
- Live cell capacity: `0x3a1d51c00`
- Stored message: `buidlLabs3 Campaign 02: this cell carries a small note, and the out point becomes the bookmark.`
- Encoded cell data: `0x627569646c4c616273332043616d706169676e2030323a20746869732063656c6c2063617272696573206120736d616c6c206e6f74652c20616e6420746865206f757420706f696e74206265636f6d65732074686520626f6f6b6d61726b2e`
- Decoded live-cell data: `buidlLabs3 Campaign 02: this cell carries a small note, and the out point becomes the bookmark.`

## Screenshots

1. [OffCKB devnet setup](screenshots/01-devnet-setup.png)
2. [Encode and decode message](screenshots/02-encode-decode-message.png)
3. [Build transaction with outputsData](screenshots/03-build-transaction.png)
4. [Retrieve live cell data](screenshots/04-retrieve-live-cell-data.png)
5. [Final result summary](screenshots/05-result-summary.png)

## Logs

- [Devnet setup log](logs/01-devnet-setup.log)
- [Full tutorial run log](logs/02-store-data-tutorial.log)
- [Encode/decode step log](logs/02-encode-decode.log)
- [Build transaction step log](logs/03-build-transaction.log)
- [Retrieve live cell step log](logs/04-retrieve-live-cell.log)
- [Result summary log](logs/05-result-summary.log)
- [Machine-readable proof JSON](store-data-result.json)

## Rerun

Start OffCKB devnet first:

```bash
offckb node
```

Then run:

```bash
cd nervos-anchor-quest
npm install
npm run campaign02:store-data
```

The script reads the local devnet signing key from `.env`, which is intentionally ignored by git.

## Explorer Note

This was completed on local OffCKB devnet. These hashes are real for the local chain, but they are not expected to appear on public mainnet or testnet explorers.
