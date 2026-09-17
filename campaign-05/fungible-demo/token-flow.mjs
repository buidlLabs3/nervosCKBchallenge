import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { rpc, units, wallet } from "./chain.mjs";

const folder = fileURLToPath(new URL("../proof/", import.meta.url));
const lines = [];
const record = (line) => { lines.push(line); console.log(line); };
const api = async (method, params) => {
  const reply = await fetch(rpc, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  if (!reply.ok) throw new Error(`RPC HTTP ${reply.status}`);
  const value = await reply.json();
  if (value.error) throw new Error(JSON.stringify(value.error));
  return value.result;
};
const outputPoint = (hash, index) => ({ tx_hash: hash, index: `0x${index.toString(16)}` });
const amountOf = (hex) => BigInt(`0x${hex.slice(2).match(/../g).reverse().join("")}`);
const addressBook = execFileSync("offckb", ["accounts"], { encoding: "utf8" });
function account(slot) {
  const block = addressBook.split(/- "#": /).find((part) => part.startsWith(`${slot}\n`));
  if (!block) throw new Error(`OffCKB account ${slot} was not found.`);
  return { secret: block.match(/privkey: (0x[0-9a-f]+)/)[1], address: block.match(/address: (ckt\w+)/)[1] };
}
const makerSlot = Number(process.env.MAKER_SLOT ?? "12");
const guestSlot = Number(process.env.GUEST_SLOT ?? "13");
const maker = account(makerSlot);
const guest = account(guestSlot);
const size = process.env.BATCH_SIZE ?? "720";
const share = process.env.SEND_SIZE ?? "180";
assert(units(share) < units(size), "The proof expects a partial transfer with change.");
assert.notEqual(makerSlot, guestSlot);
await mkdir(folder, { recursive: true });
const started = new Date().toISOString();
const head = await api("get_tip_header", []);
const { tag } = await wallet(maker.secret);
record(`Workshop Credits / buidlLabs3 / ${started}`);
record(`Network: local OffCKB only (${rpc}); starting block ${BigInt(head.number)}`);
record(`Account slots: issuer ${makerSlot}, recipient ${guestSlot}`);
record(`Issuer Lock Script Hash: ${tag}`);

let serverText = "";
const server = spawn(process.execPath, ["node_modules/parcel/lib/bin.js", "workshop.html", "--host", "127.0.0.1", "--port", "1252"], {
  cwd: fileURLToPath(new URL(".", import.meta.url)), stdio: ["ignore", "pipe", "pipe"],
});
server.stdout.on("data", (chunk) => { serverText += chunk.toString(); });
server.stderr.on("data", (chunk) => { serverText += chunk.toString(); });
server.on("error", (error) => { serverText += error.message; });
let browser;
try {
  const url = "http://127.0.0.1:1252/workshop.html";
  let ready = false;
  for (let attempt = 0; attempt < 120; attempt++) {
    if (server.exitCode !== null) throw new Error(`DApp server exited: ${serverText}`);
    try {
      const response = await fetch(url);
      if (response.ok && (await response.text()).includes("Workshop Credits · buidlLabs3")) { ready = true; break; }
    } catch {}
    await new Promise((done) => setTimeout(done, 500));
  }
  if (!ready) throw new Error(`DApp did not start: ${serverText}`);
  record(`DApp HTTP 200: ${url}`);
  browser = await chromium.launch({ headless: true });
  const tab = await browser.newPage({ viewport: { width: 1280, height: 1050 }, deviceScaleFactor: 1 });
  const faults = [];
  tab.on("pageerror", (error) => { faults.push(error.message); record(`Browser error: ${error.message}`); });
  await tab.goto(url, { waitUntil: "networkidle" });
  await tab.waitForFunction(() => Boolean(window.workshop), null, { timeout: 15000 });
  await tab.locator("#secret").fill(maker.secret);
  await tab.locator("#stock").fill(size);
  await tab.locator("#guest").fill(guest.address);
  await tab.locator("#part").fill(share);
  await tab.locator("#make").click();
  await tab.waitForFunction(() => window.workshop.batch || document.querySelector("#notice").dataset.error === "true", null, { timeout: 150000 });
  assert.equal(await tab.locator("#notice").getAttribute("data-error"), "false", await tab.locator("#notice").textContent());
  const batch = await tab.evaluate(() => window.workshop.batch);
  assert.equal(batch.tag, tag);
  record(`Create committed: ${batch.hash}; amount ${batch.size}`);
  await tab.locator("#tag").fill(tag);
  await tab.locator("#find").click();
  await tab.waitForFunction(() => document.querySelector("#notice").textContent.startsWith("Lookup complete:") || document.querySelector("#notice").dataset.error === "true");
  assert.equal(await tab.locator("#notice").getAttribute("data-error"), "false", await tab.locator("#notice").textContent());
  const before = await tab.evaluate(() => window.workshop.rows);
  assert(before.some((row) => row.point.txHash === batch.hash && row.count === size));
  record(`Lookup by issuer hash found ${before.length} live cells, including this ${size}-token batch.`);
  const createdCell = await api("get_live_cell", [outputPoint(batch.hash, 0), true]);
  assert.equal(createdCell.status, "live");
  await tab.screenshot({ path: `${folder}/batch-created.png`, fullPage: true });

  await tab.locator("#send").click();
  await tab.waitForFunction(() => document.querySelector("#notice").textContent.startsWith("Transfer committed.") || document.querySelector("#notice").dataset.error === "true", null, { timeout: 150000 });
  assert.equal(await tab.locator("#notice").getAttribute("data-error"), "false", await tab.locator("#notice").textContent());
  const receipt = await tab.evaluate(() => window.workshop);
  assert.equal(faults.length, 0, faults.join("\n"));
  const creation = await api("get_transaction", [batch.hash]);
  const delivery = await api("get_transaction", [receipt.sent.hash]);
  assert.equal(creation.tx_status.status, "committed");
  assert.equal(delivery.tx_status.status, "committed");
  const usedCell = await api("get_live_cell", [outputPoint(batch.hash, 0), true]);
  // get_live_cell returns "unknown" for a spent cell on this CKB version.
  // The committed transfer input below proves which transaction consumed it.
  assert.notEqual(usedCell.status, "live");
  const next = await Promise.all([0, 1].map((index) => api("get_live_cell", [outputPoint(receipt.sent.hash, index), true])));
  assert(next.every((value) => value.status === "live"));
  const kept = (units(size) - units(share)).toString();
  const issued = creation.transaction.outputs[0];
  const outgoing = delivery.transaction.outputs;
  assert.equal(creation.transaction.outputs_data[0].length, 34, "Amount occupies 16 bytes.");
  assert.equal(amountOf(creation.transaction.outputs_data[0]).toString(), size);
  assert.equal(amountOf(delivery.transaction.outputs_data[0]).toString(), share);
  assert.equal(amountOf(delivery.transaction.outputs_data[1]).toString(), kept);
  assert.deepEqual(outgoing[0].type, issued.type);
  assert.deepEqual(outgoing[1].type, issued.type);
  assert.notDeepEqual(outgoing[0].lock, issued.lock);
  assert.equal(outgoing[0].lock.args, receipt.sent.target.args);
  assert.deepEqual(outgoing[1].lock, issued.lock);
  assert(delivery.transaction.inputs.some((input) => input.previous_output.tx_hash === batch.hash && input.previous_output.index === "0x0"));
  const fresh = receipt.rows.filter((row) => row.point.txHash === receipt.sent.hash);
  assert.equal(fresh.length, 2);
  assert.equal(fresh.reduce((sum, row) => sum + BigInt(row.count), 0n), units(size));
  record(`Send committed: ${receipt.sent.hash}; recipient ${share}, issuer change ${kept}`);
  record("RPC checks passed: issue cell consumed; both transfer cells live; Type Script unchanged; recipient Lock Script replaced; batch quantity conserved.");
  record(`DApp has no browser errors. Viewport: 1280 × 1050. Screenshots are actual browser captures.`);
  await tab.locator("#secret").fill("");
  await tab.screenshot({ path: `${folder}/credits-sent.png`, fullPage: true });
  await writeFile(`${folder}/receipt.json`, JSON.stringify({
    recordedAt: new Date().toISOString(), network: "local OffCKB devnet", rpc, app: url,
    tokenLabel: "Workshop Credits (WKC), a local display name", accounts: { makerSlot, guestSlot, issuer: batch.address, recipient: guest.address },
    amount: { created: size, sent: share, change: kept },
    issuerHash: tag, tokenArgs: batch.rule.args, createHash: batch.hash, sendHash: receipt.sent.hash,
    before, after: receipt.rows,
    checks: { bothCommitted: true, sourceConsumed: true, outputsLive: true, sameType: true, differentHolder: true, amountConserved: true, browserErrors: faults },
    raw: { creation, delivery, createdCell, usedCell, transferCells: next },
  }, null, 2) + "\n");
  record(`PASS: Create → issuer-hash lookup → ${share}-token transfer and ${kept}-token change.`);
} catch (problem) {
  record(`FAIL: ${problem.message}`);
  throw problem;
} finally {
  await browser?.close();
  server.kill("SIGTERM");
  await writeFile(`${folder}/run.log`, lines.join("\n") + "\n");
  await writeFile(`${folder}/server.log`, serverText.replace(/\x1b\[[0-9;]*m/g, ""));
}
