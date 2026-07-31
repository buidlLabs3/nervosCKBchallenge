import {
  hexFrom,
  Transaction,
  hashTypeToBytes,
  hashCkb,
  WitnessArgs,
} from "@ckb-ccc/core";
import { readFileSync } from "fs";
import {
  Resource,
  Verifier,
  DEFAULT_SCRIPT_ALWAYS_SUCCESS,
  DEFAULT_SCRIPT_CKB_JS_VM,
} from "ckb-testtool";

const VALID_PREIMAGE = "amber vault opens at sunrise";

function utf8Hex(value: string) {
  return hexFrom(new TextEncoder().encode(value));
}

function buildTransaction(expectedPreimage: string, witnessPreimage?: string) {
  const resource = Resource.default();
  const tx = Transaction.default();

  const mainScript = resource.deployCell(
    hexFrom(readFileSync(DEFAULT_SCRIPT_CKB_JS_VM)),
    tx,
    false,
  );
  const alwaysSuccessScript = resource.deployCell(
    hexFrom(readFileSync(DEFAULT_SCRIPT_ALWAYS_SUCCESS)),
    tx,
    false,
  );
  const contractScript = resource.deployCell(
    hexFrom(readFileSync("dist/hash-lock.bc")),
    tx,
    false,
  );

  const hash = hashCkb(utf8Hex(expectedPreimage));
  mainScript.args = hexFrom(
    "0x0000" +
      contractScript.codeHash.slice(2) +
      hexFrom(hashTypeToBytes(contractScript.hashType)).slice(2) +
      hash.slice(2),
  );

  const inputCell = resource.mockCell(mainScript, undefined, "0x");
  tx.inputs.push(Resource.createCellInput(inputCell));
  tx.outputs.push(Resource.createCellOutput(alwaysSuccessScript));
  tx.outputsData.push(hexFrom("0x"));

  if (witnessPreimage !== undefined) {
    tx.witnesses.push(
      hexFrom(new WitnessArgs(utf8Hex(witnessPreimage)).toBytes()),
    );
  }

  return { resource, tx, mainScript, contractScript };
}

function expectExitCode(verifier: Verifier, expectedCode: number) {
  const results = verifier.verify();
  for (const result of results) result.reportSummary();
  expect(
    results.some((result) => result.scriptErrorCode === expectedCode),
  ).toBe(true);
}

describe("hash-lock contract", () => {
  test("accepts the exact UTF-8 preimage", () => {
    const { resource, tx } = buildTransaction(VALID_PREIMAGE, VALID_PREIMAGE);
    expectExitCode(Verifier.from(resource, tx), 0);
  });

  test("rejects a different preimage with exit code 11", () => {
    const { resource, tx } = buildTransaction(
      VALID_PREIMAGE,
      "amber vault opens at sunset",
    );
    expectExitCode(Verifier.from(resource, tx), 11);
  });

  test("rejects an empty witness lock with exit code 10", () => {
    const { resource, tx } = buildTransaction(VALID_PREIMAGE, "");
    expectExitCode(Verifier.from(resource, tx), 10);
  });

  test("rejects missing hash bytes with exit code 12", () => {
    const { resource, tx, mainScript, contractScript } = buildTransaction(
      VALID_PREIMAGE,
      VALID_PREIMAGE,
    );
    mainScript.args = hexFrom(
      "0x0000" +
        contractScript.codeHash.slice(2) +
        hexFrom(hashTypeToBytes(contractScript.hashType)).slice(2),
    );
    expectExitCode(Verifier.from(resource, tx), 12);
  });
});
