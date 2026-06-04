import { hexFrom, Transaction, hashTypeToBytes } from "@ckb-ccc/core";
import { readFileSync } from "fs";
import { Resource, Verifier, DEFAULT_SCRIPT_ALWAYS_SUCCESS, DEFAULT_SCRIPT_CKB_JS_VM } from "ckb-testtool";

const ANCHOR_MARKER = "0x434b425f4348414c4c454e47455f414e43484f525f5632"; // CKB_CHALLENGE_ANCHOR_V2
const ANCHOR_NOTE =
  ANCHOR_MARKER + "2d7365636f6e642d7265706f2d6465766e65742d70726f6f66"; // -second-repo-devnet-proof
const ANCHOR_CAPACITY = 240_00000000n;

describe("anchor-note reserve contract", () => {
  test("accepts a marked anchor note cell", async () => {
    const resource = Resource.default();
    const tx = Transaction.default();

    const mainScript = resource.deployCell(hexFrom(readFileSync(DEFAULT_SCRIPT_CKB_JS_VM)), tx, false);
    const alwaysSuccessScript = resource.deployCell(hexFrom(readFileSync(DEFAULT_SCRIPT_ALWAYS_SUCCESS)), tx, false);
    const contractScript = resource.deployCell(hexFrom(readFileSync("dist/anchor-note.bc")), tx, false);

    mainScript.args = hexFrom(
      "0x0000" +
        contractScript.codeHash.slice(2) +
        hexFrom(hashTypeToBytes(contractScript.hashType)).slice(2) +
        "0000000000000000000000000000000000000000000000000000000000000000",
    );

    const fundingCell = resource.mockCell(alwaysSuccessScript, undefined, "0x", ANCHOR_CAPACITY + 1_00000000n);
    tx.inputs.push(Resource.createCellInput(fundingCell));

    tx.outputs.push(Resource.createCellOutput(alwaysSuccessScript, mainScript, ANCHOR_CAPACITY));
    tx.outputsData.push(hexFrom(ANCHOR_NOTE));

    const verifier = Verifier.from(resource, tx);
    await verifier.verifySuccess(true);
  });
});
