import { hexFrom, ccc, hashTypeToBytes } from "@ckb-ccc/core";
import scripts from "../deployment/scripts.json";
import systemScripts from "../deployment/system-scripts.json";
import { buildClient, buildSigner } from "./helper";

const ANCHOR_MARKER = "0x434b425f4348414c4c454e47455f414e43484f525f5632"; // CKB_CHALLENGE_ANCHOR_V2
const ANCHOR_NOTE =
  ANCHOR_MARKER + "2d7365636f6e642d7265706f2d6465766e65742d70726f6f66"; // -second-repo-devnet-proof
const ANCHOR_CAPACITY = 240_00000000n;

describe("anchor-note reserve contract", () => {
  let client: ccc.Client;
  let signer: ccc.SignerCkbPrivateKey;

  beforeAll(() => {
    client = buildClient("devnet");
    signer = buildSigner(client);
  });

  test("creates a marked anchor note cell on devnet", async () => {
    const ckbJsVmScript = systemScripts.devnet["ckb_js_vm"];
    const contractScript = scripts.devnet["anchor-note.bc"];

    const mainScript = {
      codeHash: ckbJsVmScript.script.codeHash,
      hashType: ckbJsVmScript.script.hashType,
      args: hexFrom(
        "0x0000" +
          contractScript.codeHash.slice(2) +
          hexFrom(hashTypeToBytes(contractScript.hashType)).slice(2) +
          "0000000000000000000000000000000000000000000000000000000000000000",
      ),
    };

    const signerLock = (await signer.getRecommendedAddressObj()).script;
    const toLock = {
      codeHash: signerLock.codeHash,
      hashType: signerLock.hashType,
      args: signerLock.args,
    };

    const tx = ccc.Transaction.from({
      outputs: [
        {
          capacity: ANCHOR_CAPACITY,
          lock: toLock,
          type: mainScript,
        },
      ],
      outputsData: [ANCHOR_NOTE],
      cellDeps: [
        ...ckbJsVmScript.script.cellDeps.map((c) => c.cellDep),
        ...contractScript.cellDeps.map((c) => c.cellDep),
      ],
    });

    await tx.completeInputsByCapacity(signer);
    await tx.completeFeeBy(signer, 1000);
    const txHash = await signer.sendTransaction(tx);
    console.log("Anchor note transaction sent: " + txHash);
  });
});
