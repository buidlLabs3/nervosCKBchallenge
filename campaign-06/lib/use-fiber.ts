'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { BrowserNodeState, GetPaymentResult } from '@fiber-pay/sdk/browser';
import { channelReady, FUNDING_FEE_BUFFER, MIN_CHANNEL, parseCkb, samePublicKey, toHex } from './amounts';
import { connectPeer, PEER_KEY, queryBalance, startNode, type Channel, type Runtime } from './fiber';

export type WorkshopEvent = { id: number; kind: 'node' | 'channel' | 'payment'; name: string; detail: string };
export type Receipt = {
  hash: `0x${string}`; channelId: string; amount: bigint;
  status: string; before: bigint; after: bigint | null; fee: bigint | null;
};
const message = (error: unknown) => error instanceof Error ? error.message : 'The operation could not be completed.';
const closed = (channel: Channel) => channel.state.state_name.replaceAll('_', '').toLowerCase() === 'closed';

export function useFiber() {
  const runtime = useRef<Runtime | null>(null);
  const actionLock = useRef(false);
  const refreshing = useRef(false);
  const channelRef = useRef<Channel | null>(null);
  const receiptRef = useRef<Receipt | null>(null);
  const eventId = useRef(0);
  const [nodeState, setNodeState] = useState<BrowserNodeState>('idle');
  const [pubkey, setPubkey] = useState('');
  const [address, setAddress] = useState('');
  const [peers, setPeers] = useState(0);
  const [balance, setBalance] = useState<bigint | null>(null);
  const [channel, setChannel] = useState<Channel | null>(null);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [events, setEvents] = useState<WorkshopEvent[]>([]);
  const [action, setAction] = useState('');
  const [error, setError] = useState('');
  const [refreshError, setRefreshError] = useState('');

  const log = useCallback((kind: WorkshopEvent['kind'], name: string, detail: string) => {
    const event = { id: ++eventId.current, kind, name, detail };
    setEvents(items => [...items.slice(-79), event]);
  }, []);

  const keepReceipt = useCallback((next: Receipt) => {
    receiptRef.current = next;
    setReceipt(next);
  }, []);

  const applyChannel = useCallback((next: Channel | null) => {
    if (next && (next.channel_id !== channelRef.current?.channel_id
      || next.state.state_name !== channelRef.current?.state.state_name)) {
      log('channel', 'channel_state', next.state.state_name);
    }
    channelRef.current = next;
    setChannel(next);
  }, [log]);

  const sync = useCallback(async () => {
    const current = runtime.current;
    if (!current || !current.node.isRunning || refreshing.current) return;
    refreshing.current = true;
    try {
      const [peerList, channelList] = await Promise.all([current.node.listPeers(), current.node.listChannels()]);
      if (runtime.current !== current) return;
      setPeers(peerList.peers.filter(peer => samePublicKey(peer.pubkey, PEER_KEY)).length);
      const available = channelList.channels.filter(item => samePublicKey(item.pubkey, PEER_KEY));
      const selected = available.find(item => item.channel_id === channelRef.current?.channel_id)
        ?? available.find(item => !closed(item)) ?? available[0] ?? null;
      applyChannel(selected);
      const pending = receiptRef.current;
      if (pending && pending.status !== 'Success' && pending.status !== 'Failed') {
        const payment = await current.node.getPayment({ payment_hash: pending.hash });
        if (payment.status === 'Success' || payment.status === 'Failed') {
          const latest = (await current.node.listChannels()).channels.find(item => item.channel_id === pending.channelId);
          keepReceipt({ ...pending, status: payment.status, after: latest ? BigInt(latest.local_balance) : null, fee: BigInt(payment.fee ?? '0x0') });
          if (latest) applyChannel(latest);
          log('payment', 'payment_result', `${payment.status} · ${pending.hash}`);
        }
      } else if (pending?.status === 'Success' && selected?.channel_id === pending.channelId
        && pending.after !== BigInt(selected.local_balance)) {
        keepReceipt({ ...pending, after: BigInt(selected.local_balance) });
      }
      const capacity = await queryBalance(current.info);
      if (runtime.current === current) { setBalance(capacity); setRefreshError(''); }
    } catch (error) {
      if (runtime.current === current) setRefreshError(message(error));
    } finally { refreshing.current = false; }
  }, [applyChannel, keepReceipt, log]);

  useEffect(() => {
    const tick = () => { if (document.visibilityState === 'visible') void sync(); };
    const interval = setInterval(tick, 3000);
    document.addEventListener('visibilitychange', tick);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', tick);
      const previous = runtime.current;
      runtime.current = null;
      void previous?.stop().catch(() => undefined);
    };
  }, [sync]);

  async function run(name: string, operation: () => Promise<void>) {
    if (actionLock.current) return;
    actionLock.current = true;
    setAction(name); setError('');
    try { await operation(); }
    catch (error) { setError(message(error)); }
    finally { actionLock.current = false; setAction(''); }
  }

  async function prepare(connect: boolean) {
    await run('start', async () => {
      if (!runtime.current?.node.isRunning) {
        if (runtime.current) { await runtime.current.stop(); runtime.current = null; }
        const current = await startNode(setNodeState, error => setError(message(error)));
        runtime.current = current;
        setPubkey(current.info.pubkey);
        setAddress(current.address);
        log('node', 'node_started', current.info.pubkey);
      }
      if (connect) {
        await connectPeer(runtime.current.node);
        setPeers(1);
        log('node', 'peer_connected', '1 public peer · WSS');
      }
      await sync();
    });
  }

  async function connect() {
    await run('connect', async () => {
      const node = runtime.current?.node;
      if (!node?.isRunning) throw new Error('Start the browser node first.');
      await connectPeer(node);
      setPeers(1);
      log('node', 'peer_connected', '1 public peer · WSS');
      await sync();
    });
  }

  async function openChannel(amount: string) {
    await run('channel', async () => {
      const current = runtime.current;
      if (!current?.node.isRunning) throw new Error('Start the browser node first.');
      const value = parseCkb(amount);
      if (value < MIN_CHANNEL) throw new Error('The public peer requires at least 499 CKB.');
      const peerList = await current.node.listPeers();
      if (!peerList.peers.some(peer => samePublicKey(peer.pubkey, PEER_KEY))) throw new Error('Connect the public peer first.');
      const existing = (await current.node.listChannels()).channels.find(item => samePublicKey(item.pubkey, PEER_KEY) && !closed(item));
      if (existing) { applyChannel(existing); throw new Error('An existing channel is already opening or ready. Continue with that channel.'); }
      const capacity = await queryBalance(current.info);
      setBalance(capacity);
      if (capacity < value + FUNDING_FEE_BUFFER) throw new Error('Fund the displayed address with the channel amount plus 1 CKB for fees.');
      const result = await current.node.openChannel({ pubkey: PEER_KEY, funding_amount: toHex(value), public: true });
      log('channel', 'channel_opening', `Negotiation started · ${result.temporary_channel_id}`);
      await sync();
    });
  }

  async function pay(amount: string) {
    await run('payment', async () => {
      const node = runtime.current?.node;
      if (!node?.isRunning) throw new Error('Start the browser node first.');
      if (receiptRef.current && !['Success', 'Failed'].includes(receiptRef.current.status)) {
        throw new Error('The previous payment is still being checked. Wait for its result.');
      }
      const value = parseCkb(amount);
      const selected = (await node.listChannels()).channels.find(item => item.channel_id === channelRef.current?.channel_id);
      if (!selected || !channelReady(selected.state.state_name)) throw new Error('Wait for CHANNEL_READY before sending a payment.');
      if (value > BigInt(selected.local_balance)) throw new Error('The payment exceeds the local channel balance.');
      log('payment', 'payment_sending', `${amount} CKB · keysend`);
      const payment: GetPaymentResult = await node.sendPayment({ target_pubkey: PEER_KEY, amount: toHex(value), keysend: true });
      keepReceipt({
        hash: payment.payment_hash, channelId: selected.channel_id,
        amount: value, status: payment.status, before: BigInt(selected.local_balance),
        after: null, fee: null,
      });
      log('payment', 'payment_submitted', payment.payment_hash);
      if (payment.status === 'Success' || payment.status === 'Failed') {
        const latest = (await node.listChannels()).channels.find(item => item.channel_id === selected.channel_id);
        keepReceipt({ ...receiptRef.current!, after: latest ? BigInt(latest.local_balance) : null, fee: BigInt(payment.fee ?? '0x0') });
        log('payment', 'payment_result', `${payment.status} · ${payment.payment_hash}`);
      }
      await sync();
    });
  }

  async function stop() {
    await run('stop', async () => {
      const current = runtime.current;
      if (!current) return;
      await current.stop();
      runtime.current = null;
      setPeers(0);
      log('node', 'node_stopped', 'Identity and channel data remain in this browser.');
    });
  }

  return {
    nodeState, pubkey, address, peers, balance, channel, receipt, events, action,
    error, refreshError, prepare, connect, openChannel, pay, stop,
    refresh: () => run('refresh', sync),
  };
}
