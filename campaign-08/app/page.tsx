'use client';

import { useEffect, useRef, useState } from 'react';
import { scriptToAddress, type Channel, type FiberBrowserNode, type GetPaymentResult } from '@fiber-pay/sdk/browser';
import { channelReady, FUNDING_FEE_BUFFER, formatCkb, fundingTransaction, MAX_FEE_AMOUNT, PAYMENT_AMOUNT, samePublicKey } from '../lib/amounts';
import { channelFundingGuidance } from '../lib/channel-funding';
import { decryptResult, sha256Hex, toHex as bytesToHex } from '../lib/crypto';
import {
  CHANNEL_CAPACITY, ensureBottleConnected, PEER_KEY, connectAndOpenChannel, readChannel, ready, startRole, type Role,
} from '../lib/fiber';
import { createOffer, parseOffer, type EncryptedOffer } from '../lib/offer';
import { payForOffer, validateOffer } from '../lib/payment';
import { createBrowserNodeSession } from '../lib/node-session';
import {
  buyerProfile, encryptedSessionKey, readEncryptedProgress, savedNodeIdentifier, sellerProfile,
  type EncryptedLessonProgress,
} from '../lib/progress';
import { queryBalance } from '../lib/testnet-balance';

const sample = 'Fiber Testnet report\n\nPayment settled. The encrypted result is readable.';

export default function Page() {
  const nodes = useRef<Partial<Record<Role, FiberBrowserNode>>>({});
  const sessions = useRef<Partial<Record<Role, ReturnType<typeof createBrowserNodeSession>>>>({});
  const fundingScripts = useRef<Partial<Record<Role, unknown>>>({});
  const progress = useRef<EncryptedLessonProgress | null>(null);
  const locked = useRef(false);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [addresses, setAddresses] = useState<Partial<Record<Role, string>>>({});
  const [balances, setBalances] = useState<Partial<Record<Role, bigint | null>>>({});
  const [balanceNote, setBalanceNote] = useState<Partial<Record<Role, string>>>({});
  const [connected, setConnected] = useState<Partial<Record<Role, boolean>>>({});
  const [channels, setChannels] = useState<Partial<Record<Role, Channel>>>({});
  const [plaintext, setPlaintext] = useState(sample);
  const [generated, setGenerated] = useState('');
  const [received, setReceived] = useState('');
  const [offer, setOffer] = useState<EncryptedOffer | null>(null);
  const [attempt, setAttempt] = useState('');
  const [tested, setTested] = useState(false);
  const [payment, setPayment] = useState<GetPaymentResult | null>(null);
  const [key, setKey] = useState('');
  const [decrypted, setDecrypted] = useState('');
  const [liqStuck, setLiqStuck] = useState(false);
  const [liqNote, setLiqNote] = useState('');
  const [liqHash, setLiqHash] = useState('');
  const [liqVerify, setLiqVerify] = useState('');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [cardError, setCardError] = useState<Partial<Record<Role | 'liquidity', string>>>({});
  const [preimageCheck, setPreimageCheck] = useState('');

  useEffect(() => {
    const saved = readEncryptedProgress(sessionStorage, localStorage);
    progress.current = saved;
    if (saved) {
      setGenerated(saved.generatedOffer);
      setReceived(saved.buyerOfferText);
      setAttempt(saved.attemptedPaymentHash);
      setTested(saved.triedWithoutKey);
    }
    setLoaded(true);
    const sellerId = savedNodeIdentifier(localStorage, sellerProfile);
    const storedTransfer = sellerId ? sessionStorage.getItem(`fiber-unlock:inbound:${sellerId}`) : null;
    if (storedTransfer === 'submitting') setLiqStuck(true);
    else if (storedTransfer) setLiqHash(storedTransfer);
    const owned = sessions.current;
    const stop = () => { for (const session of Object.values(owned)) void session.stop().catch(() => {}); };
    window.addEventListener('pagehide', stop);
    return () => { window.removeEventListener('pagehide', stop); stop(); nodes.current = {}; sessions.current = {}; };
  }, []);

  useEffect(() => {
    if (!loaded) return;
    const tick = () => {
      if (document.visibilityState !== 'visible') return;
      for (const role of Object.keys(fundingScripts.current) as Role[]) void loadBalance(role);
    };
    const interval = setInterval(tick, 15_000);
    return () => clearInterval(interval);
  }, [loaded]);

  // Payment commitment check: payment_hash must equal sha256(payment_preimage).
  useEffect(() => {
    let cancelled = false;
    const preimage = payment?.status === 'Success' ? payment.payment_preimage : null;
    if (!preimage || !payment) {
      setPreimageCheck('');
      return () => { cancelled = true; };
    }
    setPreimageCheck('checking…');
    sha256Hex(preimage)
      .then(hash => {
        if (cancelled) return;
        setPreimageCheck(hash.toLowerCase() === payment.payment_hash.toLowerCase() ? 'match' : 'mismatch');
      })
      .catch(() => { if (!cancelled) setPreimageCheck('unavailable'); });
    return () => { cancelled = true; };
  }, [payment]);

  function save(update: Partial<EncryptedLessonProgress>) {
    const buyerId = savedNodeIdentifier(localStorage, buyerProfile);
    const sellerId = savedNodeIdentifier(localStorage, sellerProfile);
    if (!buyerId || !sellerId) throw new Error('Start both saved nodes before continuing.');
    const next: EncryptedLessonProgress = {
      version: 1, buyerId, sellerId, generatedOffer: '', buyerOfferText: '',
      attemptedPaymentHash: '', triedWithoutKey: false, ...progress.current, ...update,
    };
    sessionStorage.setItem(encryptedSessionKey, JSON.stringify(next));
    progress.current = next;
  }

  async function run(action: () => Promise<void>, scope?: Role | 'liquidity') {
    if (locked.current) return;
    locked.current = true; setBusy(true); setError('');
    if (scope) setCardError(previous => ({ ...previous, [scope]: undefined }));
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      // A wedged WASM call must not disable the whole page forever.
      const running = action();
      running.catch(() => { /* Reported by the race if the action wins it. */ });
      await Promise.race([
        running,
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error(
            'This action took longer than 120 s and the button was released. '
            + 'Check the channel or payment status before trying again.',
          )), 120_000);
        }),
      ]);
    } catch (failure) {
      const message = failure instanceof Error
        ? failure.message : 'Action failed. Check status before retrying a transfer.';
      setError(message);
      // Show the failure inside the card the user just clicked, not only at the top.
      if (scope) setCardError(previous => ({ ...previous, [scope]: message }));
    } finally {
      if (timer) clearTimeout(timer);
      locked.current = false; setBusy(false);
    }
  }

  async function loadBalance(role: Role) {
    const script = fundingScripts.current[role];
    if (!script) return;
    try {
      const capacity = await queryBalance(script);
      setBalances(previous => ({ ...previous, [role]: capacity }));
      setBalanceNote(previous => {
        if (!(role in previous)) return previous;
        const next = { ...previous };
        delete next[role];
        return next;
      });
    } catch (failure) {
      setBalanceNote(previous => ({
        ...previous,
        [role]: failure instanceof Error ? failure.message : 'Unable to read the Testnet balance.',
      }));
    }
  }

  async function refresh(role: Role) {
    const node = nodes.current[role];
    if (!node) throw new Error(`Start the ${role === 'buyer' ? 'Buyer A' : 'Seller C'} node first.`);
    const [channel, peerList] = await Promise.all([readChannel(node), node.listPeers()]);
    setConnected(previous => ({
      ...previous,
      [role]: peerList.peers.some(peer => samePublicKey(peer.pubkey, PEER_KEY)),
    }));
    setChannels(previous => ({ ...previous, [role]: channel }));
    await loadBalance(role);
  }

  async function start(role: Role) {
    if (nodes.current[role]) return;
    const session = sessions.current[role] ??= createBrowserNodeSession();
    let started: FiberBrowserNode | undefined;
    await session.start(role === 'buyer' ? buyerProfile : sellerProfile, async (track) => {
      started = await startRole(role, track);
    });
    if (!started) throw new Error('The browser node did not start. Reload the page and try again.');
    nodes.current[role] = started;
    const info = await started.nodeInfo();
    fundingScripts.current[role] = info.default_funding_lock_script;
    setAddresses(previous => ({ ...previous, [role]: scriptToAddress(info.default_funding_lock_script, 'testnet') }));
    await loadBalance(role);
    if (await readChannel(started)) await ensureBottleConnected(started);
    await refresh(role);
  }

  async function open(role: Role) {
    const node = nodes.current[role];
    if (!node) throw new Error('Start this node first.');
    setStatus('Opening the 500 CKB channel with Bottle…');
    const channel = await connectAndOpenChannel(node);
    setChannels(previous => ({ ...previous, [role]: channel }));
    await refresh(role);
    setStatus(channel && ready(channel)
      ? `${role === 'buyer' ? 'Buyer A' : 'Seller C'} is CHANNEL_READY.`
      : 'Channel opening submitted. Check channel status after confirmation.');
  }

  async function moveLiquidity() {
    const node = nodes.current.seller;
    if (!node) throw new Error('Start the Seller C node first.');
    const id = savedNodeIdentifier(localStorage, sellerProfile);
    if (!id) throw new Error('Start the seller node first.');
    const storageKey = `fiber-unlock:inbound:${id}`;
    const existing = sessionStorage.getItem(storageKey);
    if (existing === 'submitting') {
      setLiqStuck(true);
      throw new Error('Transfer outcome unknown. Press Reset attempt below, then send again.');
    }
    let result: GetPaymentResult;
    if (existing) {
      setStatus('Checking the earlier 5 CKB transfer…');
      result = await node.getPayment({ payment_hash: existing as `0x${string}` });
    } else {
      sessionStorage.setItem(storageKey, 'submitting');
      setStatus('Sending 5 CKB from Seller C to Bottle…');
      // 5 CKB moves inbound liquidity from Bottle to the seller side.
      result = await node.sendPayment({ target_pubkey: PEER_KEY, amount: '0x1dcd6500', keysend: true });
      sessionStorage.setItem(storageKey, result.payment_hash);
      setLiqHash(result.payment_hash);
      setLiqStuck(false);
    }
    if (!['Success', 'Failed'].includes(result.status)) {
      setStatus('Waiting for the 5 CKB transfer to settle…');
      result = await node.waitForPayment(result.payment_hash, { timeout: 60_000, interval: 1_000 });
    }
    if (result.status === 'Failed') sessionStorage.removeItem(storageKey);
    setLiqHash(result.payment_hash);
    setLiqNote(`${result.status} · fee ${formatCkb(BigInt(result.fee ?? '0x0'))} (${BigInt(result.fee ?? '0x0')} shannons) · payment hash ${result.payment_hash}`);
    setStatus(`Liquidity transfer: ${result.status}`);
    await refresh('seller');
  }

  async function verifyLiquidity() {
    const node = nodes.current.seller;
    if (!node) throw new Error('Start the Seller C node first.');
    if (!liqHash) throw new Error('Send the 5 CKB transfer first — there is no payment hash to verify.');
    setStatus('Verifying the payment hash against the seller node…');
    const result = await node.getPayment({ payment_hash: liqHash as `0x${string}` });
    setLiqVerify(
      `Node RPC get_payment → ${result.status} · fee ${formatCkb(BigInt(result.fee ?? '0x0'))}`
      + ` · hash ${result.payment_hash}`
      + `${result.payment_preimage ? ' · preimage present (32 bytes)' : ' · no preimage'}`,
    );
    setStatus(`Liquidity verification: ${result.status}`);
    await refresh('seller');
  }

  async function makeOffer() {
    if (!nodes.current.seller) throw new Error('Start the Seller C node first.');
    if (!sellerChannel) throw new Error('Open the Seller C channel first.');
    if (!routeReady) throw new Error(`Route not ready — ${routeIssues.join(' · ')}.`);
    if (generated || attempt) throw new Error('An offer already exists. Use Start another offer.');
    setStatus('Encrypting the report and creating the 1 CKB invoice…');
    const value = await createOffer(nodes.current.seller, sellerChannel, plaintext);
    save({ generatedOffer: value });
    setGenerated(value);
    setStatus('Encrypted offer created. Copy it to Buyer A.');
  }

  async function validate() {
    if (!nodes.current.buyer) throw new Error('Start the Buyer A node first.');
    if (!received.trim()) throw new Error('Paste the seller offer JSON into the buyer panel first.');
    setStatus('Validating the offer with the Buyer A node…');
    const parsed = parseOffer(received);
    await validateOffer(nodes.current.buyer, parsed);
    if (attempt && parsed.paymentHash.toLowerCase() !== attempt.toLowerCase()) {
      throw new Error('Restore the offer for the previous payment.');
    }
    save({ buyerOfferText: received });
    setOffer(parsed);
    setStatus('Offer validated: Fibt Invoice, 1 CKB, matching payment hash.');
  }

  async function testLock() {
    if (!offer) throw new Error('Validate the seller offer first.');
    setStatus('Trying to decrypt without the payment key…');
    try {
      await decryptResult(offer, bytesToHex(crypto.getRandomValues(new Uint8Array(32))));
      throw new Error('Decryption unexpectedly succeeded. Create a fresh offer.');
    } catch (failure) {
      if (!(failure instanceof DOMException) || failure.name !== 'OperationError') throw failure;
    }
    save({ triedWithoutKey: true });
    setTested(true);
    setStatus('Decryption rejected: the AES-GCM key is unavailable.');
  }

  async function pay() {
    if (!nodes.current.buyer) throw new Error('Start the Buyer A node first.');
    if (!offer) throw new Error('Validate the seller offer first.');
    if (!tested) throw new Error('Use Decrypt without key first to prove the lock.');
    if (!routeReady) throw new Error(`Route not ready — ${routeIssues.join(' · ')}.`);
    setStatus('Submitting the 1 CKB payment through Bottle…');
    const result = await payForOffer(nodes.current.buyer, offer, attempt, hash => {
      save({ attemptedPaymentHash: hash });
      setAttempt(hash);
    }, payment?.status === 'Failed');
    acceptPayment(result);
    await Promise.all([refresh('buyer'), refresh('seller')]);
  }

  function acceptPayment(result: GetPaymentResult) {
    setPayment(result);
    setStatus(`Payment: ${result.status}`);
    if (result.status === 'Failed') setError(result.failed_error ?? 'Payment failed. Check liquidity and the hop hint before retrying.');
    if (result.status === 'Success' && result.payment_preimage) setKey(result.payment_preimage);
  }

  async function checkPayment() {
    if (!nodes.current.buyer) throw new Error('Start the Buyer A node first.');
    if (!offer) throw new Error('Validate the seller offer first.');
    if (!attempt) throw new Error('Pay the invoice first — there is no payment to check yet.');
    setStatus('Checking the payment status…');
    await validateOffer(nodes.current.buyer, offer);
    acceptPayment(await nodes.current.buyer.getPayment({ payment_hash: attempt as `0x${string}` }));
  }

  function startAnotherOffer() {
    if (busy || (attempt && payment?.status !== 'Failed')) return;
    save({ generatedOffer: '', buyerOfferText: '', attemptedPaymentHash: '', triedWithoutKey: false });
    setGenerated(''); setReceived(''); setOffer(null); setAttempt('');
    setTested(false); setPayment(null); setKey(''); setDecrypted(''); setError('');
    setStatus('Create a fresh encrypted offer.');
  }

  const buyerChannel = channels.buyer;
  const sellerChannel = channels.seller;
  const routeReady = Boolean(
    connected.buyer && buyerChannel && channelReady(buyerChannel.state.state_name)
    && BigInt(buyerChannel.local_balance) >= PAYMENT_AMOUNT + MAX_FEE_AMOUNT
    && connected.seller && sellerChannel && channelReady(sellerChannel.state.state_name)
    && BigInt(sellerChannel.remote_balance) >= PAYMENT_AMOUNT,
  );
  const canSubmit = Boolean(offer && tested && routeReady && !key && (!attempt || payment?.status === 'Failed'));
  const canMakeOffer = Boolean(routeReady && plaintext.trim() && !generated && !attempt);

  const routeIssues: string[] = [];
  if (!connected.buyer) routeIssues.push('Buyer A is not connected to Bottle');
  if (!buyerChannel) routeIssues.push('Buyer A has no channel yet');
  else if (!channelReady(buyerChannel.state.state_name)) routeIssues.push(`Buyer channel is ${buyerChannel.state.state_name}`);
  else if (BigInt(buyerChannel.local_balance) < PAYMENT_AMOUNT + MAX_FEE_AMOUNT) routeIssues.push('Buyer A needs 1 CKB plus fee in the channel');
  if (!connected.seller) routeIssues.push('Seller C is not connected to Bottle');
  if (!sellerChannel) routeIssues.push('Seller C has no channel yet');
  else if (!channelReady(sellerChannel.state.state_name)) routeIssues.push(`Seller channel is ${sellerChannel.state.state_name}`);
  else if (BigInt(sellerChannel.remote_balance) < PAYMENT_AMOUNT) routeIssues.push('Seller C needs at least 1 CKB inbound from Bottle');

  const liquidityReason = !sellerChannel
    ? 'Start Seller C and open its channel first.'
    : !ready(sellerChannel)
      ? `Seller channel is ${sellerChannel.state.state_name} — wait for CHANNEL_READY.`
      : BigInt(sellerChannel.local_balance) < 500_000_000n
        ? 'Seller C needs at least 5 CKB in its channel side.'
        : '';

  const channelCard = (role: Role) => {
    const channel = channels[role];
    const label = role === 'buyer' ? 'Buyer A' : 'Seller C';
    const onchain = balances[role];
    const note = balanceNote[role];
    return <section className="card" key={role}>
      <div className="card-head">
        <h2>{label}</h2>
        <span className={channel && channelReady(channel.state.state_name) ? 'pill ready' : 'pill'}>
          {channel ? channel.state.state_name : connected[role] ? 'PEER CONNECTED' : 'NOT STARTED'}
        </span>
      </div>
      {cardError[role] && <p className="notice error" role="alert">{cardError[role]}</p>}
      {!addresses[role] && <button disabled={!loaded || busy} onClick={() => void run(() => start(role), role)}>
        Start {label} node
      </button>}
      {addresses[role] && <>
        <small>Testnet funding address</small>
        <code className="address">{addresses[role]}</code>
        <p className="balance onchain" data-proof="onchain-balance">
          On-chain balance: <strong>{onchain === undefined ? 'checking…' : formatCkb(onchain)}</strong>
          {note ? ` · ${note}` : ''}
          {!note && typeof onchain === 'bigint' && onchain < CHANNEL_CAPACITY + FUNDING_FEE_BUFFER
            ? ' · faucet claims can take a minute; press Refresh' : ''}
        </p>
        <div className="row">
          <a href="https://faucet.nervos.org" target="_blank" rel="noreferrer">Get Testnet CKB ↗</a>
        </div>
        {!channel && <p className="helper">{channelFundingGuidance}</p>}
        {channel && <p className="balance">
          {label}: {formatCkb(BigInt(channel.local_balance))} · Bottle: {formatCkb(BigInt(channel.remote_balance))}
        </p>}
        {channel && fundingTransaction(channel.channel_outpoint) && <a
          href={`https://pudge.explorer.nervos.org/transaction/${fundingTransaction(channel.channel_outpoint)}`}
          target="_blank" rel="noreferrer"
        >Channel funding tx on Testnet Explorer ↗</a>}
        <div className="row">
          <button disabled={busy} onClick={() => void run(() => open(role), role)}>
            {channel ? 'Reconnect / check channel' : `Open ${formatCkb(CHANNEL_CAPACITY)} channel`}
          </button>
          <button className="secondary" disabled={busy} onClick={() => void run(() => refresh(role), role)}>Refresh</button>
        </div>
      </>}
    </section>;
  };

  return <main className="shell">
    <header className="topbar">
      <span className="brand"><span className="brand-mark">f</span>Fiber pay to unlock</span>
      <span className="network-tag"><i className="dot active" />CKB Testnet</span>
    </header>

    <section className="hero">
      <p className="eyebrow">Encrypted data · one CKB · Fiber invoice preimage</p>
      <h1>The key arrives with the payment.</h1>
      <p>Seller C encrypts a result with AES-256-GCM and puts the same 32 bytes in the Invoice as its payment preimage. Buyer A pays 1 CKB through Bottle; settlement reveals the preimage, and only then does the ciphertext open.</p>
    </section>

    <div className="route">
      <b>Buyer A</b><span>— 1 CKB —▶</span><b>Bottle</b><span>— 1 CKB —▶</span><b>Seller C</b>
    </div>

    {(addresses.buyer || addresses.seller) && (routeReady
      ? <p className="notice ok" data-proof="route-ready">Route ready: both channels are CHANNEL_READY with enough balance for the 1 CKB payment.</p>
      : <p className="notice">Route not ready — {routeIssues.join(' · ')}.</p>)}

    {status && <p className={error ? 'notice error' : 'notice ok'} role="status">{status}{busy ? ' …' : ''}</p>}
    {!status && busy && <p className="notice" role="status">Working…</p>}
    {error && <p className="notice error" role="alert">{error}</p>}

    <div className="steps">
      <div><b>1</b><p><strong>Two nodes.</strong> Start Buyer A and Seller C, then fund each address.</p></div>
      <div><b>2</b><p><strong>Two channels.</strong> Open 500 CKB each and wait for CHANNEL_READY.</p></div>
      <div><b>3</b><p><strong>One offer.</strong> Encrypt, invoice, copy the JSON, prove the lock.</p></div>
    </div>

    <div className="grid two" data-proof="channels">
      {channelCard('buyer')}
      {channelCard('seller')}
    </div>

    <section className="card" style={{ marginTop: 12 }}>
      <div className="card-head"><h2>Liquidity</h2><span className="pill">OPTIONAL</span></div>
      {cardError.liquidity && <p className="notice error" role="alert">{cardError.liquidity}</p>}
      <p className="helper">Bottle brings 250 CKB to each channel, leaving about 150 CKB routable toward the seller. If the seller already has enough inbound liquidity, skip this. The transfer moves 5 CKB from Seller C back to Bottle.</p>
      {sellerChannel && <p className="balance" data-proof="channel-balances">
        Live channel — Seller C: <strong>{formatCkb(BigInt(sellerChannel.local_balance))}</strong>
        {' · '}Bottle side: <strong>{formatCkb(BigInt(sellerChannel.remote_balance))}</strong>
        {' '}inbound toward the seller
      </p>}
      <div className="row">
        <button className="secondary" disabled={busy || !sellerChannel || !ready(sellerChannel) || BigInt(sellerChannel.local_balance) < 500_000_000n} onClick={() => void run(moveLiquidity, 'liquidity')}>
          Send / check 5 CKB transfer
        </button>
        {liqHash && <button className="secondary" disabled={busy} onClick={() => void run(verifyLiquidity, 'liquidity')}>
          Verify hash via node RPC
        </button>}
        {liqStuck && <button className="secondary" disabled={busy} onClick={() => {
          const id = savedNodeIdentifier(localStorage, sellerProfile);
          if (id) sessionStorage.removeItem(`fiber-unlock:inbound:${id}`);
          setLiqStuck(false); setLiqNote(''); setLiqHash(''); setLiqVerify('');
          setStatus('Stuck transfer attempt cleared. You can send again.');
        }}>Reset attempt</button>}
      </div>
      {liquidityReason && !busy && <p className="helper">{liquidityReason}</p>}
      {liqNote && <p className="balance" data-proof="liquidity">{liqNote}</p>}
      {liqHash && <p className="helper">
        This payment hash is off-chain: Fiber settlements move balance inside the channel and
        create no transaction, so no CKB explorer page exists for it. The verifiable artifacts are
        the Seller C <b>channel funding tx</b> and <b>funding address</b> links (node card above),
        the in-app <b>sha256(preimage) = payment hash</b> check, and the node RPC below.
      </p>}
      {liqHash && liqVerify && <p className="balance" data-proof="liquidity-verify">{liqVerify}</p>}
      {liqHash && addresses.seller && <div className="row">
        <a href={`https://pudge.explorer.nervos.org/address/${addresses.seller}`} target="_blank" rel="noreferrer">
          Seller funding address on Testnet Explorer ↗
        </a>
      </div>}
    </section>

    <div className="grid exchange">
      <section className="card" data-proof="offer">
        <div className="card-head"><h2>Seller C · encrypt</h2><span className="pill">{generated ? 'OFFER READY' : 'PLAINTEXT'}</span></div>
        {cardError.seller && <p className="notice error" role="alert">{cardError.seller}</p>}
        <textarea aria-label="Seller result" disabled={busy || Boolean(generated)} value={plaintext} onChange={event => setPlaintext(event.target.value)} />
        <button disabled={busy || !canMakeOffer} onClick={() => void run(makeOffer, 'seller')}>Encrypt &amp; create 1 CKB invoice</button>
        {!generated && !attempt && !routeReady && <p className="helper">Waiting for the route above to show “Route ready”.</p>}
        <small>Public offer JSON</small>
        <textarea aria-label="Generated offer" readOnly value={generated} />
        <div className="row">
          <button className="secondary" disabled={!generated || busy} onClick={() => void run(async () => {
            await navigator.clipboard.writeText(generated);
            setStatus('Offer copied.');
          }, 'seller')}>Copy offer</button>
          {generated && !attempt && <button className="secondary" disabled={busy} onClick={() => void run(async () => startAnotherOffer(), 'seller')}>Start another offer</button>}
        </div>
      </section>

      <section className="card" data-proof="buyer">
        <div className="card-head"><h2>Buyer A · unlock</h2><span className="pill">{key ? 'KEY REVEALED' : tested ? 'LOCK VERIFIED' : 'WAITING'}</span></div>
        {cardError.buyer && <p className="notice error" role="alert">{cardError.buyer}</p>}
        <small>Paste the seller offer</small>
        <textarea aria-label="Received offer" disabled={busy || Boolean(offer || attempt)} value={received} onChange={event => { setReceived(event.target.value); setTested(false); }} />
        {received.trim()
          ? <p className="helper">✓ Offer pasted ({received.length} characters).</p>
          : <p className="helper">Waiting for the offer JSON — press Copy offer on Seller C, then paste it here.</p>}
        {!addresses.buyer && <p className="helper">Start the Buyer A node first: press Start on the Buyer A card above.</p>}
        <button disabled={busy || Boolean(offer)} onClick={() => void run(validate, 'buyer')}>Validate offer</button>
        {!offer && received.trim() && <p className="helper">Now press Validate offer — “Decrypt without key” unlocks after validation.</p>}
        {!tested && <button className="secondary" disabled={busy || !offer} onClick={() => void run(testLock, 'buyer')}>Decrypt without key</button>}
        {!offer && <p className="helper">Decrypt without key stays disabled until the offer is validated.</p>}
        {tested && <p className="proof-line" data-proof="decryption-rejected">Decryption rejected: AES-GCM authentication failed without the payment preimage.</p>}
        {offer && !key && <p className="helper">Buyer decrypts only with the invoice preimage, which Fiber returns after the 1 CKB payment settles — pay to receive it.</p>}
        {canSubmit && <button disabled={busy} onClick={() => void run(pay, 'buyer')}>{attempt ? 'Retry failed payment' : 'Pay 1 CKB'}</button>}
        {attempt && !key && <button className="secondary" disabled={busy || !offer || !addresses.buyer} onClick={() => void run(checkPayment, 'buyer')}>Check payment status</button>}
        {key && !decrypted && <p className="helper">Payment key received (32 bytes) — press Decrypt with revealed key to open the seller message.</p>}
        {key && <button disabled={busy || Boolean(decrypted)} onClick={() => void run(async () => {
          setDecrypted(await decryptResult(offer!, key));
        }, 'buyer')}>Decrypt with revealed key</button>}
      </section>
    </div>

    {payment && <section className="card receipt" data-proof="receipt" style={{ marginTop: 12 }}>
      <div className="card-head"><h2>Payment receipt</h2><span className={payment.status === 'Success' ? 'pill ready' : 'pill'}>{payment.status}</span></div>
      <dl>
        <div><dt>Amount</dt><dd>{formatCkb(PAYMENT_AMOUNT)}</dd></div>
        <div><dt>Routing fee</dt><dd>{formatCkb(BigInt(payment.fee ?? '0x0'))}</dd></div>
        <div><dt>Invoice paid</dt><dd>1 CKB · Fibt</dd></div>
        <div><dt>Preimage received</dt><dd>{payment.payment_preimage ? 'yes (32 bytes)' : 'no'}</dd></div>
        <div><dt>Payment commitment</dt><dd>
          {payment.status !== 'Success' || !payment.payment_preimage
            ? 'available after settlement'
            : preimageCheck === 'match'
              ? 'sha256(preimage) = payment hash ✓'
              : preimageCheck === 'mismatch'
                ? 'sha256 mismatch — do not trust this receipt'
                : `${preimageCheck}…`}
        </dd></div>
        <div className="full"><dt>Payment hash</dt><dd>{payment.payment_hash}</dd></div>
        <div className="full"><dt>Explorer</dt><dd>Settles off-chain in the channel — payment hashes do not appear on the CKB explorer; use the channel funding tx links above, or press Check payment status to re-query the node RPC.</dd></div>
      </dl>
    </section>}

    {decrypted && <section className="result" data-proof="decrypted">
      <small>Decrypted result · matches the seller plaintext</small>
      <pre>{decrypted}</pre>
    </section>}

    <footer>
      <span>Testnet only. Keys and decrypted results are never written to storage.</span>
      <button className="text" disabled={busy} onClick={() => void run(async () => {
        for (const session of Object.values(sessions.current)) await session.stop().catch(() => {});
        nodes.current = {}; sessions.current = {}; fundingScripts.current = {};
        setAddresses({}); setConnected({}); setBalances({}); setBalanceNote({});
        setStatus('Nodes stopped. Saved identities remain in this browser.');
      })}>Stop nodes</button>
    </footer>
  </main>;
}
