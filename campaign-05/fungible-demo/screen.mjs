import { mint, move, scan } from "./chain.mjs";

const field = (name) => document.getElementById(name);
let batch;
let busy = false;
const history = { batch: null, sent: null, rows: [] };
// Public transaction evidence only. The key stays in the masked input.
window.workshop = history;

function note(text, failed = false) {
  field("notice").textContent = text;
  field("notice").dataset.error = String(failed);
}

async function run(label, action) {
  if (busy) return;
  busy = true;
  for (const item of document.querySelectorAll("button")) item.disabled = true;
  note(label);
  try { await action(); }
  catch (problem) { note(problem.message ?? String(problem), true); }
  finally {
    busy = false;
    field("make").disabled = false;
    field("find").disabled = false;
    field("send").disabled = !batch || Boolean(history.sent);
  }
}

async function list() {
  const rows = await scan(field("tag").value.trim());
  history.rows = rows;
  field("cells").replaceChildren();
  for (const row of rows) {
    const line = document.createElement("tr");
    for (const text of [row.count, row.owner.args, `${row.point.txHash}:${row.point.index}`]) {
      const cell = document.createElement("td");
      cell.textContent = text;
      line.append(cell);
    }
    field("cells").append(line);
  }
  field("tally").textContent = `${rows.length} cells · ${rows.reduce((sum, row) => sum + BigInt(row.count), 0n)} tokens`;
  return rows;
}

field("make").addEventListener("click", () => run("Creating tokens; waiting for the local transaction to commit…", async () => {
  batch = await mint(field("secret").value.trim(), field("stock").value.trim());
  history.batch = batch;
  history.sent = null;
  history.rows = [];
  field("made").textContent = batch.hash;
  field("sent").textContent = "—";
  field("split").textContent = `${batch.size} tokens held by the issuer`;
  field("args").textContent = batch.rule.args;
  field("tag").value = batch.tag;
  field("cells").replaceChildren();
  field("tally").textContent = "Ready to look up this issuer";
  note(`Created ${batch.size} WKC. Transaction committed. Use Find token cells to inspect the batch.`);
}));

field("find").addEventListener("click", () => run("Reading live cells from local OffCKB…", async () => {
  const rows = await list();
  note(`Lookup complete: ${rows.length} live token cells matched the issuer Lock Script Hash.`);
}));

field("send").addEventListener("click", () => run("Changing the holder; waiting for the local transaction to commit…", async () => {
  const sent = await move(field("secret").value.trim(), batch, field("part").value.trim(), field("guest").value.trim());
  history.sent = sent;
  field("sent").textContent = sent.hash;
  field("split").textContent = `${sent.size} to recipient + ${sent.spare} issuer change = ${batch.size} WKC`;
  field("tag").value = batch.tag;
  await list();
  note(`Transfer committed. ${sent.size} WKC moved to the recipient; ${sent.spare} WKC returned to the issuer.`);
}));
