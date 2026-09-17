import { ccc } from "@ckb-ccc/core";

// The default OffCKB genesis scripts. This app only connects to local devnet.
export const rpc = "http://127.0.0.1:28114";
export const node = new ccc.ClientPublicTestnet({
  url: rpc,
  scripts: {
    [ccc.KnownScript.Secp256k1Blake160]: {
      codeHash: "0x9bd7e06f3ecf4be0f2fcd2188b23f1b9fcc88e5d4b65a8637b17723bbda3cce8",
      hashType: "type",
      cellDeps: [{ cellDep: { outPoint: { txHash: "0x4d804f1495612631da202fe9902fa9899118554b08138cfe5dfb50e1ede76293", index: 0 }, depType: "depGroup" } }],
    },
    [ccc.KnownScript.XUdt]: {
      codeHash: "0x1a1e4fef34f5982906f745b048fe7b1089647e82346074e0f32c2ece26cf6b1e",
      hashType: "type",
      cellDeps: [{ cellDep: { outPoint: { txHash: "0x1bb87da347a776a927ab6593e1e10304ca195f8e24279f039008d5e3115b1bf7", index: 6 }, depType: "code" } }],
    },
    [ccc.KnownScript.AnyoneCanPay]: {
      codeHash: "0xe09352af0066f3162287763ce4ddba9af6bfaeab198dc7ab37f8c71c9e68bb5b",
      hashType: "type",
      cellDeps: [{ cellDep: { outPoint: { txHash: "0x1bb87da347a776a927ab6593e1e10304ca195f8e24279f039008d5e3115b1bf7", index: 8 }, depType: "code" } }],
    },
    [ccc.KnownScript.OmniLock]: {
      codeHash: "0x9c6933d977360f115a3e9cd5a2e0e475853681b80d775d93ad0f8969da343e56",
      hashType: "type",
      cellDeps: [
        { cellDep: { outPoint: { txHash: "0x1bb87da347a776a927ab6593e1e10304ca195f8e24279f039008d5e3115b1bf7", index: 7 }, depType: "code" } },
        { cellDep: { outPoint: { txHash: "0x4d804f1495612631da202fe9902fa9899118554b08138cfe5dfb50e1ede76293", index: 0 }, depType: "depGroup" } },
      ],
    },
    [ccc.KnownScript.Secp256k1Multisig]: {
      codeHash: "0x5c5069eb0857efc65e1bca0c07df34c31663b3622fd3876c876320fc9634e2a8",
      hashType: "type",
      cellDeps: [{ cellDep: { outPoint: { txHash: "0x4d804f1495612631da202fe9902fa9899118554b08138cfe5dfb50e1ede76293", index: 1 }, depType: "depGroup" } }],
    },
    [ccc.KnownScript.NervosDao]: {
      codeHash: "0x82d76d1b75fe2fd9a27dfbaa65a039221a380d76c926f378d3f81cf3e7e13f2e",
      hashType: "type",
      cellDeps: [{ cellDep: { outPoint: { txHash: "0x1bb87da347a776a927ab6593e1e10304ca195f8e24279f039008d5e3115b1bf7", index: 2 }, depType: "code" } }],
    },
  },
});

export function units(text) {
  if (!/^[1-9][0-9]*$/.test(text)) throw new Error("Enter a positive whole token amount.");
  const count = BigInt(text);
  if (count >= 1n << 128n) throw new Error("The amount must fit in 128 bits.");
  return count;
}

export function plain(value) {
  return JSON.parse(JSON.stringify(value, (_, item) => typeof item === "bigint" ? item.toString() : item));
}

export async function wallet(secret) {
  if (!/^0x[0-9a-fA-F]{64}$/.test(secret)) throw new Error("Enter a 32-byte OffCKB test private key.");
  const writer = new ccc.SignerCkbPrivateKey(node, secret);
  const home = await writer.getAddressObjSecp256k1();
  return { writer, home, seal: home.script, tag: home.script.hash() };
}

export async function kind(tag) {
  if (!/^0x[0-9a-fA-F]{64}$/.test(tag)) throw new Error("Enter the issuer's 32-byte Lock Script Hash.");
  return ccc.Script.fromKnownScript(node, ccc.KnownScript.XUdt, `${tag}00000000`);
}

async function publish(draft, writer) {
  await draft.addCellDepsOfKnownScripts(node, ccc.KnownScript.XUdt);
  await draft.completeInputsByCapacity(writer);
  await draft.completeFeeBy(writer, 1000);
  const hash = await writer.sendTransaction(draft);
  await node.waitTransaction(hash, 0, 120000, 1000);
  return hash;
}

export async function mint(secret, size) {
  const { writer, seal, tag, home } = await wallet(secret);
  const rule = await kind(tag);
  const draft = ccc.Transaction.from({
    outputs: [{ lock: seal, type: rule }],
    outputsData: [ccc.numLeToBytes(units(size), 16)],
  });
  const hash = await publish(draft, writer);
  return { hash, size, tag, rule: plain(rule), seal: plain(seal), address: home.toString() };
}

export async function scan(tag) {
  const rule = await kind(tag);
  const rows = [];
  for await (const found of node.findCellsByType(rule, true)) {
    rows.push({
      point: plain(found.outPoint),
      count: ccc.numLeFromBytes(found.outputData).toString(),
      owner: plain(found.cellOutput.lock),
      rule: plain(found.cellOutput.type),
      data: found.outputData,
    });
  }
  return rows;
}

export async function move(secret, batch, size, destination) {
  const count = units(size);
  if (count > BigInt(batch.size)) throw new Error("This batch has fewer tokens than the requested amount.");
  const { writer, seal, tag } = await wallet(secret);
  if (tag !== batch.tag) throw new Error("Use the same issuer key that created this batch.");
  const target = (await ccc.Address.fromString(destination, node)).script;
  if (target.hash() === seal.hash()) throw new Error("Choose a different account to demonstrate a transfer.");
  const rule = await kind(batch.tag);
  // Spend this batch's exact token cell, so repeat runs do not mix old batches.
  const draft = ccc.Transaction.from({
    inputs: [{ previousOutput: { txHash: batch.hash, index: 0 } }],
    outputs: [{ lock: target, type: rule }],
    outputsData: [ccc.numLeToBytes(count, 16)],
  });
  const spare = (await draft.getInputsUdtBalance(node, rule)) - count;
  if (spare < 0n) throw new Error("The token input cannot cover this transfer.");
  if (spare > 0n) draft.addOutput({ lock: seal, type: rule }, ccc.numLeToBytes(spare, 16));
  const hash = await publish(draft, writer);
  return { hash, size, spare: spare.toString(), target: plain(target), rule: plain(rule) };
}
