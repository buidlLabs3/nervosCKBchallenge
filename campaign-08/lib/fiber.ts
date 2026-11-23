import type { Channel, FiberBrowserNode } from '@fiber-pay/sdk/browser';
import { channelClosed, channelReady, samePublicKey, SHANNONS, toHex } from './amounts';
import { requireChannelFunding } from './channel-funding';
import { createTestnetFiberFactory } from './fiber-testnet-runtime';
import { buyerProfile, savedNodeIdentifier, sellerProfile } from './progress';

export const PEER_KEY = '0x02b6d4e3ab86a2ca2fad6fae0ecb2e1e559e0b911939872a90abdda6d20302be71' as const;
export const PEER_ADDRESS = '/dns4/bottle.fiber.channel/tcp/443/wss/p2p/QmXen3eUHhywmutEzydCsW4hXBoeVmdET2FJvMX69XJ1Eo';
export const CHANNEL_CAPACITY = 500n * SHANNONS;

export type Role = 'buyer' | 'seller';
export type { Channel };

const CURVE_ORDER = 0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141n;

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

const fromHex = (value: string) =>
  Uint8Array.from(value.match(/.{2}/g) ?? [], (part) => Number.parseInt(part, 16));

function profile(role: Role) {
  const storageKey = role === 'buyer' ? buyerProfile : sellerProfile;
  const saved = localStorage.getItem(storageKey);
  if (saved && !savedNodeIdentifier(localStorage, storageKey)) {
    throw new Error('The saved node profile cannot be read. Keep this browser storage intact to preserve a funded node.');
  }
  if (saved) {
    const value = JSON.parse(saved);
    return {
      fiberKey: fromHex(value.fiberKey),
      ckbKey: fromHex(value.ckbKey),
      identifier: value.identifier as string,
    };
  }
  const value = { fiberKey: randomKey(), ckbKey: randomKey(), identifier: crypto.randomUUID() };
  localStorage.setItem(storageKey, JSON.stringify(value));
  return { fiberKey: fromHex(value.fiberKey), ckbKey: fromHex(value.ckbKey), identifier: value.identifier };
}

export async function startRole(role: Role, track: (node: FiberBrowserNode) => void) {
  if (!window.crossOriginIsolated) {
    throw new Error('Cross-origin isolation is required. Restart the server and reload this page.');
  }
  const { FiberBrowserNode, RawKeyCredentialProvider } = await import('@fiber-pay/sdk/browser');
  const keys = profile(role);
  const node = new FiberBrowserNode({
    wasmFactory: await createTestnetFiberFactory(),
    network: 'testnet',
    credential: new RawKeyCredentialProvider(keys.fiberKey, keys.ckbKey, keys.identifier),
    nodeConfig: { bootnodes: [], logLevel: 'info' },
  });
  track(node);
  await node.start();
  return node;
}

export function ready(channel: Channel) {
  return channelReady(channel.state.state_name);
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Fiber's handshake is asynchronous: `connectPeer` resolves once the socket is
 * up, but `open_channel` needs the peer's Init message (its feature set) first.
 * Opening too early fails with "Peer Pubkey(...)'s feature not found, waiting
 * for peer to send Init message", so wait for the peer to be listed and retry
 * handshake-pending failures with a fresh reconnect.
 */
const HANDSHAKE_PENDING = /feature not found|Init message|not connected|timed? ?out|connection (closed|reset)/i;

async function bottleConnected(node: FiberBrowserNode) {
  return (await node.listPeers()).peers.some(peer => samePublicKey(peer.pubkey, PEER_KEY));
}

async function waitForBottle(node: FiberBrowserNode, timeoutMs = 20_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await bottleConnected(node)) return;
    await sleep(1_000);
  }
  throw new Error(
    `Bottle never completed the Fiber handshake within ${Math.round(timeoutMs / 1000)}s. `
    + 'Check that the Bottle peer is reachable from Chrome, then try again.',
  );
}

async function connectBottle(node: FiberBrowserNode, force = false) {
  const known = await bottleConnected(node);
  if (known && !force) return;
  // A half-initialized peer never recovers on its own: drop it so the next
  // connect starts a fresh handshake instead of reusing the stale session.
  if (known) await node.disconnectPeer({ pubkey: PEER_KEY }).catch(() => {});
  try {
    await node.connectPeer({ address: PEER_ADDRESS, pubkey: PEER_KEY, save: true });
  } catch (failure) {
    const message = failure instanceof Error ? failure.message : String(failure);
    if (!/already (connected|exists)|duplicate|peer .*exists/i.test(message)) throw failure;
  }
  await waitForBottle(node);
}

/** Connect to Bottle and wait for its Init message, so later calls can open or pay. */
export async function ensureBottleConnected(node: FiberBrowserNode) {
  await connectBottle(node);
}

async function openWithHandshakeRetry(node: FiberBrowserNode, attempts = 8) {
  let last: Error | undefined;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await node.openChannel({
        pubkey: PEER_KEY,
        funding_amount: toHex(CHANNEL_CAPACITY),
        public: true,
      });
    } catch (failure) {
      last = failure instanceof Error ? failure : new Error(String(failure));
      if (!HANDSHAKE_PENDING.test(last.message) || attempt === attempts) break;
      await sleep(3_000);
      await connectBottle(node, true).catch(() => {});
    }
  }
  throw new Error(
    `Bottle never completed the Fiber handshake, so no channel was opened and nothing was spent `
    + `(${last?.message ?? 'unknown error'}). Try opening the channel again.`,
  );
}

export async function connectAndOpenChannel(node: FiberBrowserNode) {
  await connectBottle(node);
  const existing = await readChannel(node);
  if (existing) return existing;
  await requireChannelFunding(node);
  await openWithHandshakeRetry(node);
  return readChannel(node);
}

export async function readChannel(node: FiberBrowserNode) {
  const channels = (await node.listChannels()).channels.filter((channel) =>
    samePublicKey(channel.pubkey, PEER_KEY) && !channelClosed(channel.state.state_name));
  return channels.find(ready) ?? channels[0];
}

export function channelAmounts(channel: Channel) {
  return {
    local: BigInt(channel.local_balance),
    remote: BigInt(channel.remote_balance),
  };
}
