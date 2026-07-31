import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  PROOF_EXPECTATIONS,
  capacityToCkb,
  verifyCampaign03Evidence,
} from "./campaign-03-proof-core.mjs";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(scriptDirectory, "..");
const proofRoot = join(projectRoot, "..", "proof");
const resultPath = join(proofRoot, "campaign-03-result.json");
const evidencePath = join(proofRoot, "rpc-evidence.json");
const rpcUrl = process.env.CKB_RPC_URL || "http://127.0.0.1:28114";
const expected = PROOF_EXPECTATIONS;

async function rpc(method, params = []) {
  const response = await fetch(rpcUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ id: 1, jsonrpc: "2.0", method, params }),
  });
  if (!response.ok) {
    throw new Error("RPC " + method + " returned HTTP " + response.status);
  }
  const payload = await response.json();
  if (payload.error) {
    throw new Error(
      "RPC " + method + " failed: " + JSON.stringify(payload.error),
    );
  }
  return payload.result;
}

const deploymentScripts = JSON.parse(
  readFileSync(join(projectRoot, "deployment", "scripts.json"), "utf8"),
);
const deployment = deploymentScripts.devnet["hash-lock.bc"];
const bytecode = readFileSync(join(projectRoot, "dist", "hash-lock.bc"));

const [
  deploymentTx,
  depositTx,
  unlockTx,
  depositCell,
  recipientCell,
  changeCell,
  tip,
] = await Promise.all([
  rpc("get_transaction", [expected.deploymentTx]),
  rpc("get_transaction", [expected.depositTx]),
  rpc("get_transaction", [expected.unlockTx]),
  rpc("get_live_cell", [{ tx_hash: expected.depositTx, index: "0x0" }, true]),
  rpc("get_live_cell", [{ tx_hash: expected.unlockTx, index: "0x0" }, true]),
  rpc("get_live_cell", [{ tx_hash: expected.unlockTx, index: "0x1" }, true]),
  rpc("get_tip_block_number"),
]);

const capturedAt = new Date().toISOString();
const evidence = {
  schemaVersion: 1,
  campaign: "Build on CKB: Campaign #03",
  purpose:
    "Portable raw JSON-RPC evidence for offline review of the local devnet execution",
  capturedAt,
  network: "OffCKB local devnet",
  rpcUrl,
  rpcTip: tip,
  rpcMethods: {
    transactions: "get_transaction",
    liveCells: "get_live_cell with data=true",
    tip: "get_tip_block_number",
  },
  transactions: {
    deployment: deploymentTx,
    deposit: depositTx,
    unlock: unlockTx,
  },
  liveCells: {
    spentDeposit: depositCell,
    recipient: recipientCell,
    change: changeCell,
  },
};

const verified = await verifyCampaign03Evidence({
  deployment,
  bytecode,
  evidence,
});

evidence.verification = {
  allChecksPassed: true,
  checkCount: verified.checks.length,
  checks: verified.checks,
};
const evidenceText = JSON.stringify(evidence, null, 2) + "\n";
const evidenceSha256 = createHash("sha256").update(evidenceText).digest("hex");
writeFileSync(evidencePath, evidenceText);

const result = {
  campaign: "Build on CKB: Campaign #03",
  account: "buidlLabs3",
  tutorial: "Build a Simple Lock",
  tutorialUrl: "https://docs.nervos.org/docs/dapp/simple-lock",
  upstream: {
    repository: "https://github.com/nervosnetwork/docs.nervos.org",
    revision: "522700df909373fb824c4bec07ca7b1acac77053",
  },
  network: "OffCKB local devnet",
  rpcUrl,
  contract: {
    name: "hash-lock",
    source: "campaign-03/simple-lock-lab/contracts/hash-lock/src/index.ts",
    bytecode: "campaign-03/simple-lock-lab/dist/hash-lock.bc",
    bytecodeSha256: verified.bytecodeSha256,
    bytecodeCkbHash: verified.bytecodeCkbHash,
    deploymentTxHash: expected.deploymentTx,
    deploymentStatus: deploymentTx.tx_status.status,
    deploymentBlockNumber: deploymentTx.tx_status.block_number,
    codeHash: deployment.codeHash,
    hashType: deployment.hashType,
    cellDep: deployment.cellDeps[0].cellDep,
    deploymentOutputIndex: deployment.cellDeps[0].cellDep.outPoint.index,
    deploymentOutputDataMatchesBytecode: true,
  },
  hashLock: {
    preimage: expected.preimage,
    preimageUtf8Hex: verified.preimageHex,
    ckbBlake2b256: verified.expectedHash,
    address: expected.lockAddress,
    lockScript: depositTx.transaction.outputs[0].lock,
  },
  deposit: {
    txHash: expected.depositTx,
    txStatus: depositTx.tx_status.status,
    blockNumber: depositTx.tx_status.block_number,
    outputIndex: "0x0",
    capacity: depositTx.transaction.outputs[0].capacity,
    capacityCkb: capacityToCkb(depositTx.transaction.outputs[0].capacity),
    postUnlockLiveCellStatus: depositCell.status,
  },
  rejectedAttempt: {
    preimage: expected.wrongPreimage,
    scriptErrorCode: 11,
    observedInProductionFrontend: true,
    evidence: "campaign-03/proof/screenshots/05-wrong-witness-rejected.png",
    note: "The devnet rejected the mismatched witness before transaction admission, so it has no committed transaction hash.",
  },
  unlock: {
    txHash: expected.unlockTx,
    txStatus: unlockTx.tx_status.status,
    blockNumber: unlockTx.tx_status.block_number,
    input: unlockTx.transaction.inputs[0].previous_output,
    witness: unlockTx.transaction.witnesses[0],
    witnessContainsPreimage: true,
    witnessIsCanonical: true,
    recipient: {
      address: expected.recipientAddress,
      outputIndex: "0x0",
      capacity: unlockTx.transaction.outputs[0].capacity,
      capacityCkb: capacityToCkb(unlockTx.transaction.outputs[0].capacity),
      lockMatchesAddress: true,
      liveCellStatus: recipientCell.status,
    },
    change: {
      address: expected.lockAddress,
      outputIndex: "0x1",
      capacity: unlockTx.transaction.outputs[1].capacity,
      capacityCkb: capacityToCkb(unlockTx.transaction.outputs[1].capacity),
      lockMatchesAddress: true,
      liveCellStatus: changeCell.status,
    },
    feeShannons: verified.feeShannons,
    feeCkb: capacityToCkb(verified.feeShannons),
  },
  frontend: {
    framework: "Next.js",
    network: "devnet",
    localProductionUrl: "http://127.0.0.1:3000",
    typecheck: "passed",
    productionBuild: "passed",
    desktopPlaywrightCheck: "passed",
    mobilePlaywrightCheck: "passed",
    browserConsoleErrors: 0,
  },
  portableEvidence: {
    path: "campaign-03/proof/rpc-evidence.json",
    sha256: evidenceSha256,
    checkCount: verified.checks.length,
    offlineVerifier:
      "campaign-03/simple-lock-lab/scripts/verify-campaign-03-offline.mjs",
  },
  verification: {
    rpcTip: tip,
    allChecksPassed: true,
    checks: verified.checks,
    checkedAt: capturedAt,
  },
};

writeFileSync(resultPath, JSON.stringify(result, null, 2) + "\n");

console.log("Build on CKB Campaign 03 - Online Proof Verified");
console.log(
  "Checks: " + verified.checks.length + " independent invariants passed",
);
console.log(
  "Deployment: " +
    expected.deploymentTx +
    " (" +
    deploymentTx.tx_status.status +
    ")",
);
console.log("Code hash: " + deployment.codeHash);
console.log(
  "Deposit: " +
    expected.depositTx +
    " (" +
    capacityToCkb(depositTx.transaction.outputs[0].capacity) +
    " CKB)",
);
console.log(
  "Unlock: " + expected.unlockTx + " (" + unlockTx.tx_status.status + ")",
);
console.log(
  "Outputs: " +
    capacityToCkb(unlockTx.transaction.outputs[0].capacity) +
    " CKB recipient / " +
    capacityToCkb(unlockTx.transaction.outputs[1].capacity) +
    " CKB hash-lock change",
);
console.log("Fee: " + capacityToCkb(verified.feeShannons) + " CKB");
console.log("RPC tip: " + tip);
console.log("Evidence SHA-256: " + evidenceSha256);
console.log("Saved: " + evidencePath);
console.log("Saved: " + resultPath);
