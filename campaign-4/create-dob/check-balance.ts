import { ccc } from "@ckb-ccc/core";
import { cccClient, DEVNET_SCRIPTS } from "./ccc-client.ts";

async function main() {
  const client = new ccc.ClientPublicTestnet();
  const PRIV = "0x6109170b275a09ad54877b82f7d9930f88cab5717d484fb4741ae9d1dd078cd6";
  const signer = new ccc.SignerCkbPrivateKey(client, PRIV);
  const lock = (await signer.getAddressObjSecp256k1()).script;
  const balance = await client.getBalance([lock]);
  console.log("Testnet balance:", balance.toString(), "shannon");
  console.log("Testnet balance CKB:", (balance / 100000000n).toString(), "CKB");
}

main();
