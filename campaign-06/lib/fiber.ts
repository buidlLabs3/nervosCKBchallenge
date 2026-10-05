import type { BrowserNodeState, FiberBrowserNode, NodeInfoResult } from '@fiber-pay/sdk/browser';
import { samePublicKey } from './amounts';

export const PEER_KEY = '0x02b6d4e3ab86a2ca2fad6fae0ecb2e1e559e0b911939872a90abdda6d20302be71';
const PEER_ADDRESS = '/dns4/bottle.fiber.channel/tcp/443/wss/p2p/QmXen3eUHhywmutEzydCsW4hXBoeVmdET2FJvMX69XJ1Eo';
const IDENTITY_KEY = 'fiber-workshop.identity.v1';
const CURVE_ORDER = 0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141n;

export type Channel = Awaited<ReturnType<FiberBrowserNode['listChannels']>>['channels'][number];
export type Runtime = {
  node: FiberBrowserNode;
  info: NodeInfoResult;
  address: string;
  stop: () => Promise<void>;
};

function validKey(value: unknown): value is string {
  return typeof value === 'string' && /^[a-f0-9]{64}$/.test(value)
    && BigInt(`0x${value}`) > 0n && BigInt(`0x${value}`) < CURVE_ORDER;
}

function randomKey(): string {
  let key: string;
  do {
    key = Array.from(crypto.getRandomValues(new Uint8Array(32)), byte => byte.toString(16).padStart(2, '0')).join('');
  } while (!validKey(key));
  return key;
}

function identity() {
  const saved = localStorage.getItem(IDENTITY_KEY);
  if (saved) {
    try {
      const value = JSON.parse(saved);
      if (!validKey(value.fiberKey) || !validKey(value.ckbKey)
        || typeof value.identifier !== 'string' || !value.identifier) throw new Error();
      return value as { fiberKey: string; ckbKey: string; identifier: string };
    } catch {
      throw new Error('The stored node identity cannot be read. Keep this browser storage intact to preserve existing channels.');
    }
  }
  const value = { fiberKey: randomKey(), ckbKey: randomKey(), identifier: crypto.randomUUID() };
  localStorage.setItem(IDENTITY_KEY, JSON.stringify(value));
  return value;
}

async function acquireNodeLock(): Promise<() => void> {
  if (!navigator.locks) throw new Error('Use a current Chrome or Chromium browser to run this node.');
  return new Promise((resolve, reject) => {
    void navigator.locks.request('fiber-workshop-node', { ifAvailable: true }, async lock => {
      if (!lock) {
        reject(new Error('This node is already running in another tab. Use that tab or stop its node first.'));
        return;
      }
      await new Promise<void>(release => resolve(release));
    }).catch(reject);
  });
}

export async function startNode(
  onState: (state: BrowserNodeState) => void,
  onError: (error: Error) => void,
): Promise<Runtime> {
  if (!window.crossOriginIsolated || typeof SharedArrayBuffer === 'undefined') {
    throw new Error('Browser isolation is missing. Run the app with npm run dev, then reload this page.');
  }
  const release = await acquireNodeLock();
  let node: FiberBrowserNode | undefined;
  try {
    const { FiberBrowserNode, RawKeyCredentialProvider, scriptToAddress } = await import('@fiber-pay/sdk/browser');
    const keys = identity();
    const bytes = (hex: string) => Uint8Array.from(hex.match(/../g)!, part => parseInt(part, 16));
    node = new FiberBrowserNode({
      network: 'testnet',
      credential: new RawKeyCredentialProvider(bytes(keys.fiberKey), bytes(keys.ckbKey), keys.identifier),
      nodeConfig: { bootnodes: [], logLevel: 'info' },
    });
    node.on('stateChange', onState);
    node.on('error', onError);
    const info = await node.start();
    const address = scriptToAddress(info.default_funding_lock_script, 'testnet');
    if (!address.startsWith('ckt1')) throw new Error('The node did not return a Testnet funding address.');
    const runningNode = node;
    return {
      node: runningNode, info, address,
      async stop() {
        try { await runningNode.stop(); } finally { release(); }
      },
    };
  } catch (error) {
    await node?.stop().catch(() => undefined);
    release();
    throw error;
  }
}

export async function connectPeer(node: FiberBrowserNode) {
  let peers = (await node.listPeers()).peers;
  if (!peers.some(peer => samePublicKey(peer.pubkey, PEER_KEY))) {
    await node.connectPeer({ address: PEER_ADDRESS, pubkey: PEER_KEY });
  }
  for (let attempt = 0; attempt < 20; attempt++) {
    peers = (await node.listPeers()).peers;
    if (peers.some(peer => samePublicKey(peer.pubkey, PEER_KEY))) return peers;
    await new Promise(resolve => setTimeout(resolve, 750));
  }
  throw new Error('The public peer has not connected yet. Try Connect public peer again.');
}

export async function queryBalance(info: NodeInfoResult): Promise<bigint> {
  const response = await fetch('https://testnet.ckbapp.dev/', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(15_000),
    body: JSON.stringify({
      jsonrpc: '2.0', id: 1, method: 'get_cells_capacity',
      params: [{ script: info.default_funding_lock_script, script_type: 'lock', script_search_mode: 'exact', filter: { script_len_range: ['0x0', '0x1'] } }],
    }),
  });
  if (!response.ok) throw new Error(`The Testnet balance service returned HTTP ${response.status}.`);
  const result = await response.json();
  if (!/^0x[0-9a-f]+$/i.test(result.result?.capacity ?? '')) {
    throw new Error(result.error?.message ?? 'Unable to read the Testnet balance.');
  }
  return BigInt(result.result.capacity);
}
