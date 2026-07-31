import { execFileSync } from "node:child_process";

const RPC_URL = process.env.CKB_RPC_URL || "http://127.0.0.1:28114";

function version(command, args = ["--version"]) {
  return execFileSync(command, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  }).trim();
}

async function rpc(method, params = []) {
  const response = await fetch(RPC_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ id: 1, jsonrpc: "2.0", method, params }),
  });
  if (!response.ok) {
    throw new Error(`RPC ${method} returned HTTP ${response.status}`);
  }
  const payload = await response.json();
  if (payload.error) {
    throw new Error(`RPC ${method} failed: ${JSON.stringify(payload.error)}`);
  }
  return payload.result;
}

console.log("Build on CKB Campaign 03 - Environment");
console.log("Account: buidlLabs3");
console.log("Network: OffCKB local devnet");
console.log(`Node.js: ${version("node")}`);
console.log(`pnpm: ${version("pnpm")}`);
console.log(`Git: ${version("git", ["--version"])}`);
console.log(`OffCKB: ${version("offckb")}`);
console.log(`RPC: ${RPC_URL}`);
console.log(`RPC tip: ${await rpc("get_tip_block_number")}`);
console.log(
  `Deployment status: ${
    (
      await rpc("get_transaction", [
        "0x7ed208e44b0b25b85a23b006f496b3ff7d33aa14a8dfcece46c30e8dda4f48dc",
      ])
    ).tx_status.status
  }`,
);
