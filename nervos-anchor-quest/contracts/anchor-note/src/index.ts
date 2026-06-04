import * as bindings from "@ckb-js-std/bindings";
import { HighLevel, log } from "@ckb-js-std/core";

const ERROR_NO_OUTPUT = 20;
const ERROR_MULTIPLE_OUTPUTS = 21;
const ERROR_MARKER_MISSING = 22;
const ERROR_RESERVE_TOO_LOW = 23;

const RESERVE_CAPACITY = 20_00000000n; // Keep 20 CKB above the occupied capacity.
const ANCHOR_MARKER = [
  67, 75, 66, 95, 67, 72, 65, 76, 76, 69, 78, 71, 69, 95, 65, 78, 67, 72, 79, 82, 95, 86,
  50,
]; // CKB_CHALLENGE_ANCHOR_V2

function startsWithAnchorMarker(data: ArrayBuffer): boolean {
  const bytes = new Uint8Array(data);
  if (bytes.length < ANCHOR_MARKER.length) {
    return false;
  }

  for (let i = 0; i < ANCHOR_MARKER.length; i++) {
    if (bytes[i] !== ANCHOR_MARKER[i]) {
      return false;
    }
  }

  return true;
}

function main(): number {
  log.setLevel(log.LogLevel.Debug);

  const script = HighLevel.loadScript();
  const outputCapacities = new HighLevel.QueryIter(
    HighLevel.loadCellCapacity,
    HighLevel.SOURCE_GROUP_OUTPUT,
  ).toArray();

  if (outputCapacities.length === 0) {
    log.error("anchor note requires one grouped output cell");
    return ERROR_NO_OUTPUT;
  }

  if (outputCapacities.length > 1) {
    log.error("anchor note accepts exactly one grouped output cell");
    return ERROR_MULTIPLE_OUTPUTS;
  }

  const outputData = HighLevel.loadCellData(0, HighLevel.SOURCE_GROUP_OUTPUT);
  if (!startsWithAnchorMarker(outputData)) {
    log.error("output data must start with CKB_CHALLENGE_ANCHOR_V2");
    return ERROR_MARKER_MISSING;
  }

  const occupiedCapacity = HighLevel.loadCellOccupiedCapacity(0, HighLevel.SOURCE_GROUP_OUTPUT);
  if (outputCapacities[0] < occupiedCapacity + RESERVE_CAPACITY) {
    log.error("anchor note output does not leave the 20 CKB reserve");
    return ERROR_RESERVE_TOO_LOW;
  }

  log.debug("anchor note accepted script args: " + JSON.stringify(script.args));
  return 0;
}

bindings.exit(main());
