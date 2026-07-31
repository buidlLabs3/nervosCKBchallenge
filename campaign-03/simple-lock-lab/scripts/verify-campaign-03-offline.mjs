import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
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
const evidencePath = join(proofRoot, "rpc-evidence.json");
const resultPath = join(proofRoot, "campaign-03-result.json");

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(
      label +
        " mismatch: expected " +
        String(expected) +
        ", received " +
        String(actual),
    );
  }
}

const deploymentScripts = JSON.parse(
  readFileSync(join(projectRoot, "deployment", "scripts.json"), "utf8"),
);
const deployment = deploymentScripts.devnet["hash-lock.bc"];
const bytecode = readFileSync(join(projectRoot, "dist", "hash-lock.bc"));
const evidenceText = readFileSync(evidencePath, "utf8");
const evidence = JSON.parse(evidenceText);
const result = JSON.parse(readFileSync(resultPath, "utf8"));
const evidenceSha256 = createHash("sha256").update(evidenceText).digest("hex");

const verified = await verifyCampaign03Evidence({
  deployment,
  bytecode,
  evidence,
});

assertEqual(evidence.schemaVersion, 1, "Evidence schema");
assertEqual(
  evidence.verification.allChecksPassed,
  true,
  "Captured evidence verification",
);
assertEqual(
  evidence.verification.checkCount,
  verified.checks.length,
  "Captured evidence check count",
);
assertEqual(
  JSON.stringify(evidence.verification.checks),
  JSON.stringify(verified.checks),
  "Captured evidence check list",
);
assertEqual(
  result.portableEvidence.sha256,
  evidenceSha256,
  "Portable evidence SHA-256",
);
assertEqual(
  result.portableEvidence.checkCount,
  verified.checks.length,
  "Result check count",
);
assertEqual(
  JSON.stringify(result.verification.checks),
  JSON.stringify(verified.checks),
  "Result check list",
);
assertEqual(
  result.verification.checkedAt,
  evidence.capturedAt,
  "Capture timestamp",
);
assertEqual(
  result.contract.bytecodeSha256,
  verified.bytecodeSha256,
  "Result bytecode SHA-256",
);
assertEqual(
  result.contract.bytecodeCkbHash,
  verified.bytecodeCkbHash,
  "Result bytecode CKB hash",
);
assertEqual(
  result.contract.deploymentTxHash,
  PROOF_EXPECTATIONS.deploymentTx,
  "Result deployment transaction",
);
assertEqual(
  result.deposit.txHash,
  PROOF_EXPECTATIONS.depositTx,
  "Result deposit transaction",
);
assertEqual(
  result.unlock.txHash,
  PROOF_EXPECTATIONS.unlockTx,
  "Result unlock transaction",
);
assertEqual(
  result.unlock.feeShannons,
  verified.feeShannons,
  "Result transaction fee",
);

console.log("Build on CKB Campaign 03 - Offline Proof Verified");
console.log(
  "Checks: " + verified.checks.length + " transaction invariants passed",
);
console.log("Portable evidence SHA-256: " + evidenceSha256);
console.log("Bytecode SHA-256: " + verified.bytecodeSha256);
console.log("Bytecode CKB hash: " + verified.bytecodeCkbHash);
console.log("Deployment: " + PROOF_EXPECTATIONS.deploymentTx + " / committed");
console.log(
  "Deposit: " +
    PROOF_EXPECTATIONS.depositTx +
    " / " +
    capacityToCkb(verified.depositTx.transaction.outputs[0].capacity) +
    " CKB",
);
console.log("Unlock: " + PROOF_EXPECTATIONS.unlockTx + " / committed");
console.log(
  "Outputs: " +
    capacityToCkb(verified.unlockTx.transaction.outputs[0].capacity) +
    " CKB recipient / " +
    capacityToCkb(verified.unlockTx.transaction.outputs[1].capacity) +
    " CKB hash-lock change",
);
console.log(
  "No RPC connection was used; verification read only checked-in artifacts.",
);
