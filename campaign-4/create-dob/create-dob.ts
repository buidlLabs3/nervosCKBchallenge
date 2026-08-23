/**
 * Campaign 04 - Create a DOB on OffCKB devnet
 *
 * This script:
 * 1. Reads an image file
 * 2. Creates an on-chain digital object (DOB) via Spore-SDK
 * 3. Fetches the DOB back from the chain and decodes the image
 * 4. Saves the decoded image to verify round-trip integrity
 */

import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import { createDefaultLockWallet, hexStringToUint8Array } from "./helper.ts";
import { ccc } from "@ckb-ccc/core";
import { setSporeConfig, createSpore, unpackToRawSporeData } from "@spore-sdk/core";
import { SPORE_CONFIG } from "./spore-config.ts";
import { DEVNET_SCRIPTS } from "./ccc-client.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ─── Config ──────────────────────────────────────────────────────────
const NETWORK = process.env.NETWORK || "devnet";
const OFFCKB_DEVNET_RPC = "http://127.0.0.1:28114";

// First account from offckb accounts (funded with 42_000_000_00000000 capacity)
const PRIVATE_KEY = "0x6109170b275a09ad54877b82f7d9930f88cab5717d484fb4741ae9d1dd078cd6";

// ─── Setup ───────────────────────────────────────────────────────────
setSporeConfig(SPORE_CONFIG);

const client =
  NETWORK === "devnet"
    ? new ccc.ClientPublicTestnet({
        url: OFFCKB_DEVNET_RPC,
        scripts: DEVNET_SCRIPTS,
      })
    : NETWORK === "testnet"
    ? new ccc.ClientPublicTestnet()
    : new ccc.ClientPublicMainnet();

// ─── Main ────────────────────────────────────────────────────────────
async function main() {
  const imagePath = process.argv[2] || resolve(__dirname, "sample-dob-image.jpg");
  console.log(`\n=== Campaign 04: Create a DOB ===`);
  console.log(`Network: ${NETWORK}`);
  console.log(`Image: ${imagePath}\n`);

  // Step 1: Read the image file
  console.log("Step 1: Reading image file...");
  const imageBuffer = readFileSync(imagePath);
  const content = new Uint8Array(imageBuffer);
  console.log(`  Image size: ${content.length} bytes`);

  // Step 2: Create the DOB on-chain
  console.log("\nStep 2: Creating DOB on-chain via Spore-SDK...");
  const wallet = createDefaultLockWallet(PRIVATE_KEY);

  const { txSkeleton, outputIndex } = await createSpore({
    data: {
      contentType: "image/jpeg",
      content,
    },
    toLock: wallet.lock,
    fromInfos: [wallet.address],
    config: SPORE_CONFIG,
  });

  const txHash = await wallet.signAndSendTransaction(txSkeleton);
  const sporeId = txSkeleton.get("outputs").get(outputIndex)!.cellOutput.type!.args;

  console.log(`  ✅ DOB created successfully!`);
  console.log(`  Transaction hash: ${txHash}`);
  console.log(`  Output index: ${outputIndex}`);
  console.log(`  Spore ID: ${sporeId}`);

  // Step 3: Fetch the DOB back from chain (wait for confirmation)
  console.log("\nStep 3: Fetching DOB from chain...");
  const indexHex = "0x" + outputIndex.toString(16);
  
  // Wait for the transaction to be confirmed
  let cell = null;
  for (let attempt = 0; attempt < 10; attempt++) {
    await new Promise(r => setTimeout(r, 2000));
    cell = await client.getCellLive({ txHash, index: indexHex }, true);
    if (cell) break;
    console.log(`  Waiting for confirmation (attempt ${attempt + 1}/10)...`);
  }

  if (!cell) {
    console.error("  ❌ Cell not found on chain!");
    process.exit(1);
  }

  const sporeData = unpackToRawSporeData(cell.outputData);
  console.log(`  Content type: ${sporeData.contentType}`);

  // Step 4: Decode and save the image
  console.log("\nStep 4: Decoding image from on-chain data...");
  const rawContent = sporeData.content.toString();
  const hexContent = rawContent.startsWith("0x") ? rawContent.slice(2) : rawContent;
  const decodedBytes = hexStringToUint8Array(hexContent);

  const outputPath = resolve(__dirname, "decoded-dob-image.jpg");
  writeFileSync(outputPath, decodedBuffer(decodedBytes));
  console.log(`  ✅ Image decoded and saved to: ${outputPath}`);
  console.log(`  Decoded size: ${decodedBytes.length} bytes`);

  // Step 5: Verify integrity
  const originalMatch = content.length === decodedBytes.length &&
    content.every((v, i) => v === decodedBytes[i]);

  console.log(`\n=== Verification ===`);
  console.log(`  Original size: ${content.length} bytes`);
  console.log(`  Decoded size: ${decodedBytes.length} bytes`);
  console.log(`  Round-trip integrity: ${originalMatch ? "✅ PASS" : "❌ FAIL"}`);
  console.log(`\n  Spore ID (share this): ${sporeId}`);
  console.log(`  Transaction hash: ${txHash}`);
  console.log(`  Out point: ${txHash}:0x${outputIndex.toString(16)}`);
}

function decodedBuffer(bytes) {
  return Buffer.from(bytes);
}

main().catch((err) => {
  console.error("\n❌ Error:", err);
  process.exit(1);
});
