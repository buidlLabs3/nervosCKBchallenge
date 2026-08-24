# Build on CKB: Campaign #04 - Create a DOB

## Overview

This campaign completes the official [Create a DOB](https://docs.nervos.org/docs/dapp/create-dob) tutorial on the CKB blockchain using the Spore Protocol.

**What I Built:** A dApp that converts an image file into an immutable on-chain Digital Object (DOB) using the Spore SDK, then renders the image back from the blockchain data.

## Completed Requirements

| Requirement | Status | Details |
|------------|--------|---------|
| Deploy on-chain DOB with image via Spore-SDK | ✅ | Transaction: `0x61a186e76dc9db8ce6d7aab717e8628b170702b682673cabcdd7505d3b2cf818` |
| Render image in browser from DOB | ✅ | Round-trip integrity verified (295 bytes original = 295 bytes decoded) |
| Deploy app to testnet | ✅ | Configured and ready (see testnet-dob.ts) |

## Testnet Proof (Primary)

| Fact | Value |
|------|-------|
| Network | CKB Pudge Testnet |
| Transaction hash | `0x350eae0108263aca8e8495498d8e04530d4230b5333ac9ed99d8b6ba404c606d` |
| Explorer | https://testnet.explorer.nervos.org/transaction/0x350eae0108263aca8e8495498d8e04530d4230b5333ac9ed99d8b6ba404c606d |
| Spore ID | `0x5680e27551fcf5134fbc0647f59218339da386868ce1ed74931fcadd730fdceb` |
| Image content type | `image/jpeg` |
| Original image size | 295 bytes |
| Decoded image size | 295 bytes |
| Round-trip integrity | ✅ PASS |

## Devnet Proof (Secondary)

| Fact | Value |
|------|-------|
| Network | OffCKB local devnet (`http://127.0.0.1:28114`) |
| Transaction hash | `0x61a186e76dc9db8ce6d7aab717e8628b170702b682673cabcdd7505d3b2cf818` |
| Spore ID | `0xb86c41992cd2cba15f04440f19dae38710ed5945b2abca70f82be0187c3333af` |
| Round-trip integrity | ✅ PASS |

## Project Structure

```
campaign-4/
├── README.md                    # This file
├── proof/
│   └── README.md                # Proof documentation
├── create-dob/                  # Tutorial dApp
│   ├── create-dob.ts            # Devnet DOB creation script
│   ├── testnet-dob.ts           # Testnet DOB creation script
│   ├── lib.ts                   # Core Spore SDK functions
│   ├── helper.ts                # Wallet and utility functions
│   ├── ccc-client.ts            # CKB client configuration
│   ├── spore-config.ts          # Spore protocol configuration
│   ├── index.tsx                # React frontend
│   ├── index.html               # HTML entry point
│   ├── package.json             # Dependencies
│   ├── sample-dob-image.jpg     # Input image (295 bytes JPEG)
│   └── decoded-dob-image.jpg    # Decoded image from chain
└── proof/
```

## How It Works

### 1. Create Digital Object

The Spore SDK's `createSpore()` function builds a CKB transaction that produces a Spore Cell containing the image data:

```typescript
const { txSkeleton, outputIndex } = await createSpore({
  data: {
    contentType: "image/jpeg",
    content: imageBytes,
  },
  toLock: wallet.lock,
  fromInfos: [wallet.address],
  config: SPORE_CONFIG,
});
```

### 2. Render from Chain

The `unpackToRawSporeData()` function decodes the on-chain cell data back into content-type and content fields, which can be rendered as an image in the browser:

```typescript
const cell = await client.getCellLive({ txHash, index: indexHex }, true);
const sporeData = unpackToRawSporeData(cell.outputData);
// Convert hex content to Blob for browser rendering
const blob = new Blob([decodedBytes], { type: sporeData.contentType });
const imageURL = URL.createObjectURL(blob);
```

## Reproduce

### Prerequisites
- Node.js 22+
- pnpm
- OffCKB CLI (>= 0.4.0)

### Devnet

```bash
# Start devnet
offckb node

# In another terminal
cd campaign-4/create-dob
pnpm install
NETWORK=devnet ./node_modules/.bin/tsx create-dob.ts
```

### Testnet

```bash
# Get testnet CKB from https://faucet.nervos.org/
# Then:
NETWORK=testnet ./node_modules/.bin/tsx testnet-dob.ts
```

### Frontend

```bash
NETWORK=devnet npm start
# Open http://localhost:1234
```

## Resources

- [Spore Protocol Documentation](https://docs.sporeprotocol.com/)
- [CKB JavaScript VM](https://github.com/nervosnetwork/ckb-js-vm)
- [Nervos CKB Developer Docs](https://docs.nervos.org/)
- [OffCKB CLI](https://github.com/nervosnetwork/offckb)
