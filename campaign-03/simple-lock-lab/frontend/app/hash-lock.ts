import { ccc, hexFrom, hashTypeToBytes } from "@ckb-ccc/core";
import { cccClient, readEnvNetwork } from "./ccc-client";
import scripts from "../deployment/scripts.json";
import systemScripts from "../deployment/system-scripts.json";

export type TransactionStatus =
  | "sent"
  | "pending"
  | "proposed"
  | "committed"
  | "unknown"
  | "rejected";

type DeploymentInfo = {
  codeHash: string;
  hashType: "data" | "type" | "data1" | "data2";
  cellDeps: Array<{ cellDep: ccc.CellDepLike }>;
};

export type TransferLimits = {
  availableCapacity: bigint;
  recipientMinimum: bigint;
  changeMinimum: bigint;
  maximumTransfer: bigint;
  fee: bigint;
};

const network = readEnvNetwork();
const deployments =
  (scripts as Record<string, Record<string, DeploymentInfo>>)[network] ?? {};
const system = (systemScripts as Record<string, any>)[network] ?? {};

export function textToHex(text: string): `0x${string}` {
  const bytes = new TextEncoder().encode(text);
  return `0x${Array.from(bytes, (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("")}`;
}

export function formatCkb(amount: bigint) {
  return ccc.fixedPointToString(amount);
}

export function parseCkb(amount: string) {
  return ccc.fixedPointFrom(amount);
}

export function getDeployment() {
  return deployments["hash-lock.bc"];
}

export function deriveLock(preimage: string) {
  const deployment = getDeployment();
  if (!deployment) throw new Error("hash-lock.bc is not deployed");

  const digest = ccc.hashCkb(textToHex(preimage));
  const args =
    "0x0000" +
    deployment.codeHash.slice(2) +
    hexFrom(hashTypeToBytes(deployment.hashType)).slice(2) +
    digest.slice(2);
  const lock = ccc.Script.from({
    codeHash: system.ckb_js_vm.script.codeHash,
    hashType: system.ckb_js_vm.script.hashType,
    args,
  });

  return {
    digest,
    lock,
    address: ccc.Address.fromScript(lock, cccClient).toString(),
  };
}

export async function readCapacity(address: string) {
  const parsed = await ccc.Address.fromString(address, cccClient);
  return cccClient.getBalance([parsed.script]);
}

export async function readTip() {
  return cccClient.getTip();
}

export async function getTransferLimits(
  fromAddress: string,
  recipientAddress: string,
  knownCapacity?: bigint,
): Promise<TransferLimits> {
  const fromLock = (await ccc.Address.fromString(fromAddress, cccClient))
    .script;
  const recipientLock = (
    await ccc.Address.fromString(recipientAddress, cccClient)
  ).script;
  const availableCapacity = knownCapacity ?? (await readCapacity(fromAddress));
  const recipientMinimum = ccc.fixedPointFrom(
    ccc.CellOutput.from({ capacity: 0n, lock: recipientLock }).occupiedSize,
  );
  const changeMinimum = ccc.fixedPointFrom(
    ccc.CellOutput.from({ capacity: 0n, lock: fromLock }).occupiedSize,
  );
  const fee = 1000n;
  const reservedCapacity = changeMinimum + fee;

  return {
    availableCapacity,
    recipientMinimum,
    changeMinimum,
    maximumTransfer:
      availableCapacity > reservedCapacity
        ? availableCapacity - reservedCapacity
        : 0n,
    fee,
  };
}

export async function unlock(
  fromAddress: string,
  recipientAddress: string,
  amountInCkb: string,
  witnessPreimage: string,
) {
  const deployment = getDeployment();
  if (!deployment) throw new Error("hash-lock.bc is not deployed");
  if (!witnessPreimage) throw new Error("Enter a witness preimage");

  const fromLock = (await ccc.Address.fromString(fromAddress, cccClient))
    .script;
  const recipientLock = (
    await ccc.Address.fromString(recipientAddress, cccClient)
  ).script;
  const readOnlySigner = new ccc.SignerCkbScriptReadonly(cccClient, fromLock);
  const transferCapacity = ccc.fixedPointFrom(amountInCkb);
  const limits = await getTransferLimits(fromAddress, recipientAddress);
  if (transferCapacity < limits.recipientMinimum) {
    throw new Error(
      `Recipient cell requires at least ${formatCkb(limits.recipientMinimum)} CKB`,
    );
  }
  if (transferCapacity > limits.maximumTransfer) {
    const shortfall =
      transferCapacity +
      limits.changeMinimum +
      limits.fee -
      limits.availableCapacity;
    throw new Error(
      `Transfer is ${formatCkb(shortfall)} CKB over the available limit. ` +
        `Use at most ${formatCkb(limits.maximumTransfer)} CKB so the ` +
        `${formatCkb(limits.changeMinimum)} CKB hash-lock change cell and fee remain valid`,
    );
  }

  const transaction = ccc.Transaction.from({
    outputs: [{ lock: recipientLock, capacity: transferCapacity }],
    outputsData: [],
  });
  await transaction.addCellDeps(deployment.cellDeps[0].cellDep);
  await transaction.addCellDeps(system.ckb_js_vm.script.cellDeps[0].cellDep);

  await transaction.completeInputsByCapacity(
    readOnlySigner,
    limits.changeMinimum + limits.fee,
  );

  const inputCapacity = await transaction.getInputsCapacity(cccClient);
  const balance = inputCapacity - transaction.getOutputsCapacity();
  const changeCapacity = balance - limits.fee;
  transaction.addOutput({ lock: fromLock, capacity: changeCapacity });

  transaction.setWitnessArgsAt(
    0,
    new ccc.WitnessArgs(textToHex(witnessPreimage)),
  );

  const txHash = await cccClient.sendTransaction(transaction);
  return {
    txHash,
    serialized: transaction.stringify(),
    inputCapacity,
    recipientCapacity: transferCapacity,
    changeCapacity,
    fee: limits.fee,
  };
}

export async function waitForCommit(
  txHash: string,
  onStatus?: (status: TransactionStatus) => void,
  timeoutMs = 240000,
) {
  const startedAt = Date.now();
  let previous: TransactionStatus = "sent";

  while (Date.now() - startedAt < timeoutMs) {
    const response = await cccClient.getTransaction(txHash);
    const status = (response?.status ?? "pending") as TransactionStatus;
    if (status !== previous) {
      previous = status;
      onStatus?.(status);
    }
    if (status === "committed") return response;
    if (status === "rejected") {
      throw new Error(response?.reason ?? "Transaction rejected by devnet");
    }
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }

  throw new Error(`Timed out waiting for ${txHash}`);
}
