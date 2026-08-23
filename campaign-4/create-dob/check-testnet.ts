import { ccc } from "@ckb-ccc/core";
import { DEVNET_SCRIPTS } from "./ccc-client.ts";

async function main() {
  const client = new ccc.ClientPublicTestnet();
  const PRIV = "0x6109170b275a09ad54877b82f7d9930f88cab5717d484fb4741ae9d1dd078cd6";
  const signer = new ccc.SignerCkbPrivateKey(client, PRIV);
  const addrObj = await signer.getAddressObjSecp256k1();
  console.log("Testnet address:", addrObj.toString());
  console.log("Lock script:", JSON.stringify(addrObj.script, null, 2));
  
  const balance = await client.getBalance([addrObj.script]);
  console.log("Balance:", balance.toString(), "shannon");
  console.log("Balance CKB:", (balance / 100000000n).toString(), "CKB");
}
main().catch(e => { console.error(e); process.exit(1); });
