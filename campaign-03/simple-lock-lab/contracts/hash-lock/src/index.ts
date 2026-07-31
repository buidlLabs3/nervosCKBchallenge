import * as bindings from "@ckb-js-std/bindings";
import { HighLevel, log, hashCkb, bytesEq } from "@ckb-js-std/core";

const ERROR_PREIMAGE_MISSING = 10;
const ERROR_PREIMAGE_MISMATCH = 11;
const ERROR_ARGS_MALFORMED = 12;
const CKB_JS_VM_PREFIX_BYTES = 35;
const HASH_BYTES = 32;

function main(): number {
  log.setLevel(log.LogLevel.Debug);
  const script = bindings.loadScript();
  log.debug(`hash-lock script loaded: ${JSON.stringify(script)}`);

  const scriptArgs = new Uint8Array(HighLevel.loadScript().args);
  if (scriptArgs.length !== CKB_JS_VM_PREFIX_BYTES + HASH_BYTES) {
    log.error(`Expected 67 argument bytes, received ${scriptArgs.length}`);
    return ERROR_ARGS_MALFORMED;
  }
  const expectedHash = scriptArgs.slice(CKB_JS_VM_PREFIX_BYTES);

  let preimage: ArrayBuffer | undefined;
  try {
    preimage = HighLevel.loadWitnessArgs(0, bindings.SOURCE_GROUP_INPUT).lock;
  } catch (_error) {
    log.error("The first group-input witness is missing");
    return ERROR_PREIMAGE_MISSING;
  }

  if (!preimage || preimage.byteLength === 0) {
    log.error("The witness lock field must contain a preimage");
    return ERROR_PREIMAGE_MISSING;
  }

  const actualHash = hashCkb(preimage);
  if (!bytesEq(actualHash, expectedHash.buffer)) {
    log.error("The witness preimage does not match the expected hash");
    return ERROR_PREIMAGE_MISMATCH;
  }

  log.debug("Preimage accepted");
  return 0;
}

bindings.exit(main());
