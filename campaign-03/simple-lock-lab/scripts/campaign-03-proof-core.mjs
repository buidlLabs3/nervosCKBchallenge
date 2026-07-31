import { createHash } from "node:crypto";
import { ccc, hexFrom } from "@ckb-ccc/core";

export const PROOF_EXPECTATIONS = Object.freeze({
  deploymentTx:
    "0x7ed208e44b0b25b85a23b006f496b3ff7d33aa14a8dfcece46c30e8dda4f48dc",
  depositTx:
    "0xeec534f55257885b37ff882aa47177e224c9fbfedacfd5ef898cbab9b1a9dc43",
  unlockTx:
    "0xc40a60c7556272b5cd79d9de13e9dda9b43bb7b5eb2b9f7401b8fe9075399dea",
  preimage: "amber vault opens at sunrise",
  wrongPreimage: "amber vault opens at sunset",
  lockAddress:
    "ckt1qzkymvxscq5t5rtnmmy7uhn28sxf3lxle2y4gq4r9pwksr5kfh95vqgqqp3uzyqh7t7x54vmt8vevkak2zj7sg7gfkj0urefhmpwfc058jyvuppah903y0fyvnuffulax4t0hfv3fazspya38dvxp3um590hvantqvfzsu6t",
  recipientAddress:
    "ckt1qzda0cr08m85hc8jlnfp3zer7xulejywt49kt2rr0vthywaa50xwsqt435c3epyrupszm7khk6weq5lrlyt52lg48ucew",
  depositCapacity: "0x6fc23ac00",
  recipientCapacity: "0x24e160300",
  changeCapacity: "0x4ae0da518",
  feeShannons: 1000n,
});

function recordEqual(checks, actual, expected, label) {
  if (actual !== expected) {
    throw new Error(
      label +
        " mismatch: expected " +
        String(expected) +
        ", received " +
        String(actual),
    );
  }
  checks.push(label);
}

function recordTruthy(checks, condition, label) {
  if (!condition) {
    throw new Error(label + " check failed");
  }
  checks.push(label);
}

function normalizeScript(script) {
  return {
    codeHash: script.codeHash ?? script.code_hash,
    hashType: script.hashType ?? script.hash_type,
    args: script.args,
  };
}

function recordScriptEqual(checks, actual, expected, label) {
  const normalizedActual = normalizeScript(actual);
  const normalizedExpected = normalizeScript(expected);
  recordEqual(
    checks,
    normalizedActual.codeHash,
    normalizedExpected.codeHash,
    label + " code hash",
  );
  recordEqual(
    checks,
    normalizedActual.hashType,
    normalizedExpected.hashType,
    label + " hash type",
  );
  recordEqual(
    checks,
    normalizedActual.args,
    normalizedExpected.args,
    label + " args",
  );
}

function recordLiveCellMatchesOutput(checks, liveCell, output, label) {
  recordEqual(checks, liveCell.status, "live", label + " status");
  recordEqual(
    checks,
    liveCell.cell.output.capacity,
    output.capacity,
    label + " capacity",
  );
  recordScriptEqual(
    checks,
    liveCell.cell.output.lock,
    output.lock,
    label + " lock",
  );
}

function transactionFrom(evidence, name) {
  const transaction = evidence.transactions?.[name];
  if (!transaction?.transaction || !transaction?.tx_status) {
    throw new Error("Portable evidence is missing transaction: " + name);
  }
  return transaction;
}

export function capacityToCkb(capacity) {
  return ccc.fixedPointToString(BigInt(capacity));
}

export async function verifyCampaign03Evidence({
  deployment,
  bytecode,
  evidence,
}) {
  const checks = [];
  const expected = PROOF_EXPECTATIONS;
  const deploymentTx = transactionFrom(evidence, "deployment");
  const depositTx = transactionFrom(evidence, "deposit");
  const unlockTx = transactionFrom(evidence, "unlock");
  const depositCell = evidence.liveCells?.spentDeposit;
  const recipientCell = evidence.liveCells?.recipient;
  const changeCell = evidence.liveCells?.change;

  recordTruthy(checks, depositCell, "Spent deposit cell evidence present");
  recordTruthy(checks, recipientCell, "Recipient cell evidence present");
  recordTruthy(checks, changeCell, "Change cell evidence present");

  recordEqual(
    checks,
    deploymentTx.transaction.hash,
    expected.deploymentTx,
    "Deployment transaction hash",
  );
  recordEqual(
    checks,
    depositTx.transaction.hash,
    expected.depositTx,
    "Deposit transaction hash",
  );
  recordEqual(
    checks,
    unlockTx.transaction.hash,
    expected.unlockTx,
    "Unlock transaction hash",
  );
  recordEqual(
    checks,
    deploymentTx.tx_status.status,
    "committed",
    "Deployment status",
  );
  recordEqual(
    checks,
    depositTx.tx_status.status,
    "committed",
    "Deposit status",
  );
  recordEqual(checks, unlockTx.tx_status.status, "committed", "Unlock status");

  const deploymentOutPoint = deployment.cellDeps[0].cellDep.outPoint;
  recordEqual(
    checks,
    deploymentOutPoint.txHash,
    expected.deploymentTx,
    "Deployment cell-dep transaction",
  );
  recordEqual(
    checks,
    deploymentOutPoint.index,
    0,
    "Deployment cell-dep output index",
  );

  const bytecodeHex = "0x" + bytecode.toString("hex");
  const bytecodeSha256 = createHash("sha256").update(bytecode).digest("hex");
  const bytecodeCkbHash = ccc.hashCkb(bytecodeHex);
  recordEqual(
    checks,
    bytecodeCkbHash,
    deployment.codeHash,
    "Compiled bytecode CKB hash",
  );
  recordEqual(
    checks,
    deploymentTx.transaction.outputs_data[deploymentOutPoint.index],
    bytecodeHex,
    "Committed deployment output bytecode",
  );

  const preimageHex =
    "0x" + Buffer.from(expected.preimage, "utf8").toString("hex");
  const expectedHash = ccc.hashCkb(preimageHex);
  const addressClient = new ccc.ClientPublicTestnet();
  const expectedHashLock = (
    await ccc.Address.fromString(expected.lockAddress, addressClient)
  ).script;
  const expectedRecipientLock = (
    await ccc.Address.fromString(expected.recipientAddress, addressClient)
  ).script;

  recordEqual(
    checks,
    depositTx.transaction.outputs.length,
    2,
    "Deposit output count",
  );
  recordEqual(
    checks,
    depositTx.transaction.outputs[0].capacity,
    expected.depositCapacity,
    "Deposit capacity",
  );
  recordEqual(
    checks,
    depositTx.transaction.outputs_data[0],
    "0x",
    "Deposit output data",
  );
  recordScriptEqual(
    checks,
    depositTx.transaction.outputs[0].lock,
    expectedHashLock,
    "Deposit hash-lock",
  );
  recordEqual(
    checks,
    depositTx.transaction.outputs[0].lock.args.slice(-64),
    expectedHash.slice(2),
    "Hash-lock preimage hash",
  );

  recordEqual(
    checks,
    unlockTx.transaction.inputs.length,
    1,
    "Unlock input count",
  );
  recordEqual(
    checks,
    unlockTx.transaction.inputs[0].previous_output.tx_hash,
    expected.depositTx,
    "Unlock input transaction",
  );
  recordEqual(
    checks,
    unlockTx.transaction.inputs[0].previous_output.index,
    "0x0",
    "Unlock input output index",
  );
  recordEqual(
    checks,
    unlockTx.transaction.outputs.length,
    2,
    "Unlock output count",
  );
  recordEqual(
    checks,
    unlockTx.transaction.outputs[0].capacity,
    expected.recipientCapacity,
    "Recipient capacity",
  );
  recordScriptEqual(
    checks,
    unlockTx.transaction.outputs[0].lock,
    expectedRecipientLock,
    "Recipient lock",
  );
  recordEqual(
    checks,
    unlockTx.transaction.outputs[1].capacity,
    expected.changeCapacity,
    "Hash-lock change capacity",
  );
  recordScriptEqual(
    checks,
    unlockTx.transaction.outputs[1].lock,
    expectedHashLock,
    "Hash-lock change",
  );
  recordEqual(
    checks,
    unlockTx.transaction.outputs_data[0],
    "0x",
    "Recipient output data",
  );
  recordEqual(
    checks,
    unlockTx.transaction.outputs_data[1],
    "0x",
    "Change output data",
  );

  const expectedWitness = hexFrom(new ccc.WitnessArgs(preimageHex).toBytes());
  recordEqual(
    checks,
    unlockTx.transaction.witnesses[0],
    expectedWitness,
    "Canonical preimage witness",
  );

  const outputCapacity = unlockTx.transaction.outputs.reduce(
    (sum, output) => sum + BigInt(output.capacity),
    0n,
  );
  const feeShannons =
    BigInt(depositTx.transaction.outputs[0].capacity) - outputCapacity;
  recordEqual(checks, feeShannons, expected.feeShannons, "Transaction fee");

  recordEqual(
    checks,
    depositCell.status,
    "unknown",
    "Spent deposit output status",
  );
  recordLiveCellMatchesOutput(
    checks,
    recipientCell,
    unlockTx.transaction.outputs[0],
    "Recipient live cell",
  );
  recordLiveCellMatchesOutput(
    checks,
    changeCell,
    unlockTx.transaction.outputs[1],
    "Change live cell",
  );

  return {
    checks,
    bytecodeSha256,
    bytecodeCkbHash,
    preimageHex,
    expectedHash,
    expectedWitness,
    feeShannons: feeShannons.toString(),
    deploymentTx,
    depositTx,
    unlockTx,
    depositCell,
    recipientCell,
    changeCell,
  };
}
