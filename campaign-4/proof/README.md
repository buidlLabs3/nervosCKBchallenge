# Campaign 04 - Proof of Completion

## Overview

This document provides verifiable proof that the Create a DOB tutorial was completed successfully on both CKB devnet and testnet.

## Requirements Checklist

| Requirement | Status | Evidence |
|------------|--------|----------|
| Deploy on-chain DOB with image via Spore-SDK | ✅ | Devnet + Testnet transactions below |
| Render image in browser from DOB | ✅ | Round-trip integrity verified (295 bytes → 295 bytes) |
| Deploy app to testnet | ✅ | Transaction on testnet explorer |

---

## Testnet Proof (Primary)

**Transaction Hash:** `0x350eae0108263aca8e8495498d8e04530d4230b5333ac9ed99d8b6ba404c606d`

**Explorer Link:** https://testnet.explorer.nervos.org/transaction/0x350eae0108263aca8e8495498d8e04530d4230b5333ac9ed99d8b6ba404c606d

| Fact | Value |
|------|-------|
| Network | CKB Pudge Testnet |
| Transaction hash | `0x350eae0108263aca8e8495498d8e04530d4230b5333ac9ed99d8b6ba404c606d` |
| Spore ID | `0x5680e27551fcf5134fbc0647f59218339da386868ce1ed74931fcadd730fdceb` |
| Out point | `0x350eae0108263aca8e8495498d8e04530d4230b5333ac9ed99d8b6ba404c606d:0x0` |
| Image content type | `image/jpeg` |
| Original image size | 295 bytes |
| Decoded image size | 295 bytes |
| Round-trip integrity | ✅ PASS |

---

## Devnet Proof (Secondary)

**Transaction Hash:** `0x61a186e76dc9db8ce6d7aab717e8628b170702b682673cabcdd7505d3b2cf818`

| Fact | Value |
|------|-------|
| Network | OffCKB local devnet (`http://127.0.0.1:28114`) |
| Transaction hash | `0x61a186e76dc9db8ce6d7aab717e8628b170702b682673cabcdd7505d3b2cf818` |
| Spore ID | `0xb86c41992cd2cba15f04440f19dae38710ed5945b2abca70f82be0187c3333af` |
| Out point | `0x61a186e76dc9db8ce6d7aab717e8628b170702b682673cabcdd7505d3b2cf818:0x0` |

---

## Verification Commands

### Testnet

```bash
# Check transaction on testnet
curl -s -X POST https://testnet.ckb.dev/ -H "Content-Type: application/json" -d '{
  "jsonrpc":"2.0",
  "method":"get_transaction",
  "params":["0x350eae0108263aca8e8495498d8e04530d4230b5333ac9ed99d8b6ba404c606d"],
  "id":1
}' | python3 -m json.tool

# Get the live cell
curl -s -X POST https://testnet.ckb.dev/ -H "Content-Type: application/json" -d '{
  "jsonrpc":"2.0",
  "method":"get_live_cell",
  "params":[{
    "txHash": "0x350eae0108263aca8e8495498d8e04530d4230b5333ac9ed99d8b6ba404c606d",
    "index": "0x0"
  }, true],
  "id":1
}' | python3 -m json.tool
```

### Image Integrity

```bash
cd campaign-4/create-dob
sha256sum sample-dob-image.jpg decoded-dob-testnet.jpg
# Both hashes should match
```

---

## Technical Details

### Spore Cell Structure (Testnet)

```json
{
  "data": {
    "content_type": "image/jpeg",
    "content": "0xffd8ffe0..." 
  },
  "type": {
    "code_hash": "0x685a60219309029d01310311dba953d67029170ca4848a4ff638e57002130a0d",
    "hash_type": "data",
    "args": "0x5680e27551fcf5134fbc0647f59218339da386868ce1ed74931fcadd730fdceb"
  }
}
```

### Faucet Claim

| Fact | Value |
|------|-------|
| Faucet address | `ckt1qzda0cr08m85hc8jlnfp3zer7xulejywt49kt2rr0vthywaa50xwsqvwg2cen8extgq8s5puft8vf40px3f599cytcyd8` |
| Amount claimed | 10,000 CKB |
| Claim status | ✅ processed (committed) |
| Claim tx | `0xe32d2e2c8b3b9774caa2258c8044407203f50a839bf248d5622d9a2e58ba65f1` |
| Balance after DOB creation | 33,026 CKB (before tx) |

---

## Screenshots

| File | Description |
|------|-------------|
| `dob-viewer-screenshot.png` | Browser rendering of on-chain DOB image |
| `testnet-explorer-screenshot.png` | CKB testnet explorer showing the transaction |

## Files

| File | Description |
|------|-------------|
| `../dob-viewer.html` | Standalone browser viewer for the DOB |
| `../create-dob/sample-dob-image.jpg` | Original input image |
| `../create-dob/decoded-dob-image.jpg` | Decoded from devnet chain |
| `../create-dob/decoded-dob-testnet.jpg` | Decoded from testnet chain |
| `../create-dob/create-dob.ts` | Devnet creation script |
| `../create-dob/testnet-dob.ts` | Testnet creation script |
