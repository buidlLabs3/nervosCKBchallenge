import { ccc, KnownScript } from "@ckb-ccc/core";
import dotenv from "dotenv";
import { mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

dotenv.config({ quiet: true });

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageRoot = join(__dirname, "..");
const proofDir = process.env.PROOF_DIR || join(packageRoot, "..", "campaign-02-proof");
mkdirSync(proofDir, { recursive: true });

const systemScripts = JSON.parse(readFileSync(join(packageRoot, "deployment", "system-scripts.json"), "utf8"));
let campaignConfig = {};
try {
  campaignConfig = JSON.parse(readFileSync(join(__dirname, "config.json"), "utf8"));
} catch (_error) {
  campaignConfig = {};
}

const RPC_URL = process.env.CKB_RPC_URL || "http://127.0.0.1:28114";
const ACCOUNT_LABEL = process.env.CAMPAIGN02_ACCOUNT || campaignConfig.account || "CKB builder";
const MESSAGE =
  process.env.CAMPAIGN02_MESSAGE ||
  campaignConfig.message ||
  "Store Data on Cell tutorial: this text should come back from a live cell.";

function utf8ToHex(utf8String) {
  const encoder = new TextEncoder();
  const uint8Array = encoder.encode(utf8String);
  return (
    "0x" +
    Array.prototype.map
      .call(uint8Array, (byte) => {
        return ("0" + (byte & 0xff).toString(16)).slice(-2);
      })
      .join("")
  );
}

function hexToUtf8(hexString) {
  const clean = hexString.startsWith("0x") ? hexString.slice(2) : hexString;
  if (clean.length === 0) {
    return "";
  }
  const bytes = clean.match(/[\dA-Fa-f]{2}/g)?.map((h) => parseInt(h, 16)) || [];
  return new TextDecoder("utf-8").decode(new Uint8Array(bytes));
}

async function rpc(method, params = []) {
  const response = await fetch(RPC_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ id: 1, jsonrpc: "2.0", method, params }),
  });
  if (!response.ok) {
    throw new Error(`RPC ${method} failed with HTTP ${response.status}`);
  }
  const body = await response.json();
  if (body.error) {
    throw new Error(`RPC ${method} failed: ${JSON.stringify(body.error)}`);
  }
  return body.result;
}

function buildDevnetScripts() {
  return {
    [KnownScript.Secp256k1Blake160]: systemScripts.devnet.secp256k1_blake160_sighash_all.script,
    [KnownScript.Secp256k1Multisig]: systemScripts.devnet.secp256k1_blake160_multisig_all.script,
    [KnownScript.NervosDao]: systemScripts.devnet.dao.script,
    [KnownScript.AnyoneCanPay]: systemScripts.devnet.anyone_can_pay.script,
    [KnownScript.OmniLock]: systemScripts.devnet.omnilock.script,
    [KnownScript.XUdt]: systemScripts.devnet.xudt.script,
  };
}

async function waitForCommitted(txHash) {
  for (let attempt = 1; attempt <= 40; attempt++) {
    const tx = await rpc("get_transaction", [txHash]);
    const status = tx?.tx_status?.status || "unknown";
    console.log(`  poll ${attempt}: ${status}`);
    if (status === "committed") {
      return tx;
    }
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }
  throw new Error(`Timed out waiting for ${txHash} to commit`);
}

async function main() {
  if (!process.env.PRIVATE_KEY) {
    throw new Error("PRIVATE_KEY must be present in .env or environment for local devnet signing");
  }

  console.log("Build on CKB Campaign #02 - Store Data on Cell");
  console.log(`Account label: ${ACCOUNT_LABEL}`);
  console.log(`RPC endpoint: ${RPC_URL}`);
  console.log(`Tutorial source: https://docs.nervos.org/docs/dapp/store-data-on-cell`);

  const tip = await rpc("get_tip_block_number");
  console.log(`Devnet tip before send: ${tip}`);

  console.log("\nStep 1 - Encode and decode message");
  console.log(`Original UTF-8 message: ${MESSAGE}`);
  const encoded = utf8ToHex(MESSAGE);
  const decoded = hexToUtf8(encoded);
  console.log(`Encoded hex: ${encoded}`);
  console.log(`Decoded preview: ${decoded}`);
  if (decoded !== MESSAGE) {
    throw new Error("Local encode/decode roundtrip failed");
  }

  console.log("\nStep 2 - Build transaction with data in outputsData[0]");
  const client = new ccc.ClientPublicTestnet({
    url: RPC_URL,
    scripts: buildDevnetScripts(),
    fallbacks: ["http://127.0.0.1:8114"],
  });
  const signer = new ccc.SignerCkbPrivateKey(client, process.env.PRIVATE_KEY);
  const signerAddress = await signer.getRecommendedAddressObj();
  const tx = ccc.Transaction.from({
    outputs: [{ lock: signerAddress.script }],
    outputsData: [encoded],
  });

  console.log(`Recipient lock args: ${signerAddress.script.args}`);
  console.log(`Transaction template outputs: ${tx.outputs.length}`);
  console.log(`Transaction template outputsData[0]: ${tx.outputsData[0]}`);

  await tx.completeInputsByCapacity(signer);
  await tx.completeFeeBy(signer, 1000);

  console.log(`Completed tx inputs: ${tx.inputs.length}`);
  console.log(`Completed tx outputs: ${tx.outputs.length}`);
  console.log(`Completed tx outputsData count: ${tx.outputsData.length}`);
  console.log(`Completed first output capacity: ${tx.outputs[0].capacity?.toString() || "auto"}`);

  const txHash = await signer.sendTransaction(tx);
  console.log(`Transaction sent: ${txHash}`);

  console.log("\nStep 3 - Wait for commit and retrieve Live Cell data");
  const committed = await waitForCommitted(txHash);
  const outPoint = { tx_hash: txHash, index: "0x0" };
  const liveCell = await rpc("get_live_cell", [outPoint, true]);
  const liveData = liveCell?.cell?.data?.content;
  const liveDecoded = hexToUtf8(liveData || "0x");

  console.log(`Committed block: ${committed.tx_status.block_number}`);
  console.log(`Out point: ${txHash}:0x0`);
  console.log(`Live cell status: ${liveCell.status}`);
  console.log(`Live cell capacity: ${liveCell.cell.output.capacity}`);
  console.log(`Live cell data hex: ${liveData}`);
  console.log(`Live cell decoded message: ${liveDecoded}`);

  if (liveCell.status !== "live") {
    throw new Error(`Expected live cell, got ${liveCell.status}`);
  }
  if (liveDecoded !== MESSAGE) {
    throw new Error("Live cell data did not decode to the original message");
  }

  const proof = {
    account: ACCOUNT_LABEL,
    tutorial: "Store Data on Cell",
    tutorialUrl: "https://docs.nervos.org/docs/dapp/store-data-on-cell",
    network: "OffCKB local devnet",
    rpcUrl: RPC_URL,
    tipBeforeSend: tip,
    message: MESSAGE,
    encodedHex: encoded,
    decodedPreview: decoded,
    txHash,
    outPoint: { txHash, index: "0x0" },
    txStatus: committed.tx_status.status,
    blockNumber: committed.tx_status.block_number,
    liveCellStatus: liveCell.status,
    liveCellCapacity: liveCell.cell.output.capacity,
    liveCellDataHex: liveData,
    liveCellDecoded: liveDecoded,
  };

  const proofPath = join(proofDir, "store-data-result.json");
  writeFileSync(proofPath, JSON.stringify(proof, null, 2) + "\n");
  console.log(`\nSaved proof JSON: ${proofPath}`);
  console.log("Tutorial completed: encoded, sent, committed, retrieved, and decoded live cell data.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
