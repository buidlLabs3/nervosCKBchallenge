/**
 * Campaign 04 - Create a DOB on CKB Testnet
 * Same as create-dob.ts but targets testnet
 */

import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import { createDefaultLockWallet, hexStringToUint8Array } from "./helper.ts";
import { ccc } from "@ckb-ccc/core";
import { setSporeConfig, createSpore, unpackToRawSporeData } from "@spore-sdk/core";
import { SPORE_CONFIG } from "./spore-config.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// First account from offckb accounts
const PRIVATE_KEY = "0x6109170b275a09ad54877b82f7d9930f88cab5717d484fb4741ae9d1dd078cd6";

setSporeConfig(SPORE_CONFIG);

const client = new ccc.ClientPublicTestnet();

async function main() {
  const imagePath = process.argv[2] || resolve(__dirname, "sample-dob-image.jpg");
  console.log(`\n=== Campaign 04: Create a DOB on TESTNET ===\n`);

  // Check balance first
  const wallet = createDefaultLockWallet(PRIVATE_KEY);
  const balance = await client.getBalance([wallet.lock]);
  console.log(`Testnet address: ${wallet.address}`);
  console.log(`Testnet balance: ${(balance / 100000000n).toString()} CKB\n`);

  if (balance < 1000000000n) {
    console.error("❌ Insufficient testnet CKB balance. Please fund the address first:");
    console.error(`   Address: ${wallet.address}`);
    console.error(`   Faucet: https://ckb.tools/`);
    process.exit(1);
  }

  // Read image
  console.log("Step 1: Reading image file...");
  const imageBuffer = readFileSync(imagePath);
  const content = new Uint8Array(imageBuffer);
  console.log(`  Image size: ${content.length} bytes`);

  // Create DOB
  console.log("\nStep 2: Creating DOB on testnet...");
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

  console.log(`  ✅ DOB created on testnet!`);
  console.log(`  Transaction hash: ${txHash}`);
  console.log(`  Spore ID: ${sporeId}`);

  // Fetch back
  console.log("\nStep 3: Fetching DOB from testnet...");
  const indexHex = "0x" + outputIndex.toString(16);
  let cell = null;
  for (let i = 0; i < 10; i++) {
    await new Promise(r => setTimeout(r, 3000));
    cell = await client.getCellLive({ txHash, index: indexHex }, true);
    if (cell) break;
    console.log(`  Waiting for confirmation (${i + 1}/10)...`);
  }

  if (!cell) {
    console.error("  ❌ Cell not found on testnet");
    process.exit(1);
  }

  const sporeData = unpackToRawSporeData(cell.outputData);
  console.log(`  Content type: ${sporeData.contentType}`);

  // Decode image
  const rawContent = sporeData.content.toString();
  const hexContent = rawContent.startsWith("0x") ? rawContent.slice(2) : rawContent;
  const decodedBytes = hexStringToUint8Array(hexContent);
  const outputPath = resolve(__dirname, "decoded-dob-testnet.jpg");
  writeFileSync(outputPath, Buffer.from(decodedBytes));

  console.log(`  ✅ Image decoded: ${decodedBytes.length} bytes`);
  console.log(`\n=== Testnet DOB Proof ===`);
  console.log(`  Transaction: ${txHash}`);
  console.log(`  Spore ID: ${sporeId}`);
  console.log(`  Explorer: https://testnet.explorer.nervos.org/transaction/${txHash}`);
}

main().catch((err) => {
  console.error("\n❌ Error:", err);
  process.exit(1);
});
