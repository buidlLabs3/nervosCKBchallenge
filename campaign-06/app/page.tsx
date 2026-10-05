'use client';

import { useState } from 'react';
import { channelReady, formatCkb, fundingTransaction, FUNDING_FEE_BUFFER, MIN_CHANNEL, parseCkb } from '../lib/amounts';
import { useFiber, type WorkshopEvent } from '../lib/use-fiber';

function Events({ events, title }: { events: WorkshopEvent[]; title: string }) {
  return <section className="events panel" aria-label={title}>
    <div className="panel-heading"><h2>{title}</h2><span className="live-label">LIVE</span></div>
    <ol className="event-list" aria-live="polite">
      {events.map((event, index) => <li key={event.id}>
        <span className="event-number">{String(index + 1).padStart(2, '0')}</span>
        <code>{event.name}</code><span className="event-detail">{event.detail}</span>
      </li>)}
    </ol>
    {!events.length && <p className="empty">Your node events will appear here.</p>}
  </section>;
}

function Metric({ label, value, active = false }: { label: string; value: string; active?: boolean }) {
  return <div className="metric"><span>{label}</span><strong><i className={active ? 'dot active' : 'dot'} />{value}</strong></div>;
}

function amountOrNull(value: string) {
  try { return parseCkb(value); } catch { return null; }
}

export default function Workshop() {
  const fiber = useFiber();
  const [tab, setTab] = useState<'connect' | 'pay'>('connect');
  const [channelAmount, setChannelAmount] = useState('499');
  const [paymentAmount, setPaymentAmount] = useState('1');
  const [copied, setCopied] = useState(false);
  const running = fiber.nodeState === 'running';
  const connected = running && fiber.peers > 0;
  const busy = Boolean(fiber.action);
  const ready = !!fiber.channel && channelReady(fiber.channel.state.state_name);
  const existing = !!fiber.channel && fiber.channel.state.state_name.toLowerCase() !== 'closed';
  const fundingValue = amountOrNull(channelAmount);
  const paymentValue = amountOrNull(paymentAmount);
  const pending = !!fiber.receipt && !['Success', 'Failed'].includes(fiber.receipt.status);
  const canOpen = connected && !existing && fundingValue !== null && fundingValue >= MIN_CHANNEL
    && fiber.balance !== null && fiber.balance >= fundingValue + FUNDING_FEE_BUFFER;
  const canPay = connected && ready && !pending && paymentValue !== null
    && paymentValue <= BigInt(fiber.channel!.local_balance);
  const nodeLabel = running ? 'Node running' : ['starting', 'unlocking'].includes(fiber.nodeState) ? 'Starting WASM' : fiber.nodeState === 'stopping' ? 'Stopping' : 'Ready to start';
  const fundingHash = fundingTransaction(fiber.channel?.channel_outpoint);
  const timeline = fiber.events.filter(event => event.name === 'channel_state');

  async function copyAddress() {
    try {
      await navigator.clipboard.writeText(fiber.address);
      setCopied(true); setTimeout(() => setCopied(false), 2000);
    } catch { setCopied(false); }
  }

  return <main className="workshop">
    <header className="topbar">
      <a className="brand" href="/" aria-label="Fiber Workshop home"><span className="brand-mark">f</span>Fiber Workshop</a>
      <nav aria-label="Tutorials">
        <button className={tab === 'connect' ? 'tab selected' : 'tab'} aria-pressed={tab === 'connect'} onClick={() => setTab('connect')}>01 <span>Connect</span></button>
        <button className={tab === 'pay' ? 'tab selected' : 'tab'} aria-pressed={tab === 'pay'} onClick={() => setTab('pay')}>02 <span>Pay</span></button>
      </nav>
      <div className="network-tag"><i className="dot active" />CKB Testnet</div>
    </header>

    <section className="hero">
      <span className="eyebrow">{tab === 'connect' ? '01 / MAKE THE CONNECTION' : '02 / YOUR FIRST PAYMENT'}</span>
      <h1>{tab === 'connect' ? 'A node in your browser.' : 'Small payments. Real connections.'}</h1>
      <p>{tab === 'connect'
        ? 'Start a Fiber node, meet a public peer, and watch the connection take shape. Your identity stays in this browser.'
        : 'Fund your browser node, open a payment channel, and send CKB directly to the public peer.'}</p>
    </section>

    {fiber.error && <div className="notice error" role="alert">{fiber.error}</div>}
    {fiber.refreshError && <div className="notice" role="status">Live refresh paused: {fiber.refreshError} Automatic checks will retry.</div>}

    {tab === 'connect' ? <div data-proof="connection">
      <div className="steps two">
        <div><b>1</b><p><strong>Start locally.</strong> Wait for your node public key.</p></div>
        <div><b>2</b><p><strong>Connect over WSS.</strong> Confirm one public peer.</p></div>
      </div>
      <section className="node-card panel">
        <div className="node-heading"><span className="node-mark">F</span><div><small>YOUR BROWSER NODE</small><h2>{nodeLabel}</h2></div><i className={running ? 'dot active' : 'dot'} /></div>
        <div className="node-metrics">
          <Metric label="WASM runtime" value={running ? 'Running' : 'Not running'} active={running} />
          <Metric label="Public peer" value={`${fiber.peers} connected`} active={connected} />
          <Metric label="Network" value="Fiber Testnet" active={running} />
        </div>
        <div className="identity"><small>NODE PUBLIC KEY</small><code>{fiber.pubkey || 'Start the node to create your identity.'}</code></div>
        <div className="node-buttons">
          <button disabled={busy || running} onClick={() => void fiber.prepare(false)}>{fiber.action === 'start' ? 'Starting WASM…' : running ? 'Node running' : 'Start WASM node'} <span>↗</span></button>
          <button className="secondary" disabled={busy || !running || connected} onClick={() => void fiber.connect()}>{fiber.action === 'connect' ? 'Connecting…' : connected ? '1 peer connected' : 'Connect public peer'} <span>↗</span></button>
        </div>
      </section>
      <Events events={fiber.events.filter(event => event.kind === 'node')} title="Node events" />
      <div className="next-step"><p>Connected? Keep this identity for the payment tutorial.</p><button className="text-button" onClick={() => setTab('pay')}>Continue to payments →</button></div>
    </div> : <div data-proof="payment">
      <div className="steps four">
        <div><b>1</b><p><strong>Prepare.</strong> Restore your node.</p></div>
        <div><b>2</b><p><strong>Fund.</strong> Receive Testnet CKB.</p></div>
        <div><b>3</b><p><strong>Open.</strong> Wait for ChannelReady.</p></div>
        <div><b>4</b><p><strong>Pay.</strong> Check the receipt.</p></div>
      </div>
      <div className="payment-layout">
        <Events events={fiber.events} title="Runtime events and results" />
        <section className="payment-card panel" aria-label="Payment controls">
          <div className="status-grid">
            <Metric label="Node" value={nodeLabel} active={running} />
            <Metric label="Peer" value={connected ? 'Connected' : 'Offline'} active={connected} />
            <Metric label="Channel" value={ready ? 'ChannelReady' : existing ? 'Opening' : 'Not opened'} active={ready} />
            <Metric label="Payment" value={fiber.receipt?.status ?? 'Not sent'} active={fiber.receipt?.status === 'Success'} />
          </div>

          {fiber.receipt && <section className="receipt" aria-label="Payment receipt" aria-live="polite">
            <h2>Payment receipt</h2>
            <dl>
              <div><dt>Status</dt><dd>{fiber.receipt.status}</dd></div>
              <div><dt>Amount</dt><dd>{formatCkb(fiber.receipt.amount)}</dd></div>
              <div className="full"><dt>Channel ID</dt><dd>{fiber.receipt.channelId}</dd></div>
              <div className="full"><dt>Payment hash</dt><dd>{fiber.receipt.hash}</dd></div>
              <div><dt>Local balance</dt><dd>{formatCkb(fiber.receipt.before)} → {formatCkb(fiber.receipt.after)}</dd></div>
              <div><dt>Payment fee</dt><dd>{formatCkb(fiber.receipt.fee)}</dd></div>
            </dl>
            {pending && <p>Checking the result automatically. Keep this tab open.</p>}
          </section>}

          <div className="flow"><b className="step-number">1</b><div><h3>Prepare browser node</h3><p>Restore this browser’s identity and connect.</p></div><button disabled={busy || connected} onClick={() => void fiber.prepare(true)}>{fiber.action === 'start' ? 'Preparing…' : connected ? 'Node running' : 'Prepare node'}</button></div>
          <div className="flow funding"><b className="step-number">2</b><div><h3>Fund the address</h3><code className="funding-address">{fiber.address || 'Prepare your node to reveal its address.'}</code><p className="balance">Balance: <strong>{formatCkb(fiber.balance)}</strong></p>
            {fiber.address && <div className="funding-buttons"><button className="secondary small" onClick={() => void copyAddress()}>{copied ? 'Copied' : 'Copy address'}</button><a className="button small" href="https://faucet.nervos.org/" target="_blank" rel="noreferrer">Get Testnet CKB ↗</a><button className="secondary small" disabled={busy} onClick={() => void fiber.refresh()}>Refresh</button></div>}
          </div></div>
          <div className="flow"><b className="step-number">3</b><div><h3>Open a payment channel</h3><label className="amount"><input aria-label="Channel funding amount in CKB" inputMode="decimal" maxLength={24} value={channelAmount} disabled={existing || busy} onChange={event => setChannelAmount(event.target.value)} /><span>CKB</span></label><p>Minimum 499 CKB; includes a 99 CKB reserve.</p></div><button disabled={busy || !canOpen} onClick={() => void fiber.openChannel(channelAmount)}>{ready ? 'Channel ready' : existing ? 'Opening…' : fiber.action === 'channel' ? 'Opening…' : 'Open channel'}</button></div>
          {!existing && <p className="helper">{fundingValue !== null && fundingValue < MIN_CHANNEL ? 'The peer requires a channel of at least 499 CKB.' : 'Keep at least 1 extra Testnet CKB available for the funding fee.'}</p>}
          <div className="flow"><b className="step-number">4</b><div><h3>Send CKB to the peer</h3><label className="amount"><input aria-label="Payment amount in CKB" inputMode="decimal" maxLength={24} value={paymentAmount} disabled={busy || pending} onChange={event => setPaymentAmount(event.target.value)} /><span>CKB</span></label><p>{ready ? `Available: ${formatCkb(BigInt(fiber.channel!.local_balance))}` : 'Wait for CHANNEL_READY before paying.'}</p></div><button disabled={busy || !canPay} onClick={() => void fiber.pay(paymentAmount)}>{fiber.action === 'payment' ? 'Sending…' : pending ? 'Confirming…' : 'Send payment'}</button></div>
          {timeline.length > 0 && <div className="timeline"><small>OBSERVED CHANNEL LIFECYCLE</small><div>{timeline.map(event => <span key={event.id}>{event.detail}</span>)}</div></div>}
          {fundingHash && <a className="explorer" target="_blank" rel="noreferrer" href={`https://pudge.explorer.nervos.org/transaction/${fundingHash}`}>View channel funding on Testnet Explorer ↗</a>}
        </section>
      </div>
    </div>}
    <footer><p>Testnet only. Your node identity and channel data stay in this browser.</p>{running && <button className="text-button" disabled={busy || pending} onClick={() => void fiber.stop()}>Stop node</button>}</footer>
  </main>;
}
