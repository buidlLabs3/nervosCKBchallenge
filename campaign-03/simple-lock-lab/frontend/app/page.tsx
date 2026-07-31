"use client";

import {
  Activity,
  ArrowRight,
  Check,
  Copy,
  Database,
  RefreshCw,
  Send,
  ShieldCheck,
  Terminal,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  deriveLock,
  formatCkb,
  getDeployment,
  getTransferLimits,
  parseCkb,
  readCapacity,
  readTip,
  TransferLimits,
  TransactionStatus,
  unlock,
  waitForCommit,
} from "./hash-lock";

const DEFAULT_PREIMAGE = "amber vault opens at sunrise";
const WRONG_PREIMAGE = "amber vault opens at sunset";
const DEFAULT_RECIPIENT =
  "ckt1qzda0cr08m85hc8jlnfp3zer7xulejywt49kt2rr0vthywaa50xwsqt435c3epyrupszm7khk6weq5lrlyt52lg48ucew";

type AttemptState =
  | "idle"
  | "submitting"
  | "pending"
  | "rejected"
  | "committed";
type WitnessMode = "mismatch" | "match" | "custom";
type LastTransfer = {
  input: bigint;
  recipient: bigint;
  change: bigint;
  fee: bigint;
};

function compact(value: string, head = 12, tail = 10) {
  if (value.length <= head + tail + 3) return value;
  return `${value.slice(0, head)}...${value.slice(-tail)}`;
}

function errorMessage(error: unknown) {
  const text = error instanceof Error ? error.message : String(error);
  const code = text.match(/error code ([0-9]+)/i)?.[1];
  if (code === "11" || text.includes("ValidationFailure")) {
    return "Witness rejected by hash-lock (exit code 11)";
  }
  return text.replace(/^Error:\s*/, "").split("\n")[0];
}

export default function Home() {
  const deployment = getDeployment();
  const [preimage, setPreimage] = useState(DEFAULT_PREIMAGE);
  const [witness, setWitness] = useState(WRONG_PREIMAGE);
  const [witnessMode, setWitnessMode] = useState<WitnessMode>("mismatch");
  const [recipient, setRecipient] = useState(DEFAULT_RECIPIENT);
  const [amount, setAmount] = useState("99");
  const [capacity, setCapacity] = useState(0n);
  const [tip, setTip] = useState("-");
  const [attempt, setAttempt] = useState<AttemptState>("idle");
  const [networkStatus, setNetworkStatus] = useState<"online" | "offline">(
    "offline",
  );
  const [message, setMessage] = useState("Ready");
  const [txHash, setTxHash] = useState("");
  const [lastTransfer, setLastTransfer] = useState<LastTransfer>();
  const [refreshing, setRefreshing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [limits, setLimits] = useState<TransferLimits>();

  const derived = useMemo(() => {
    try {
      return { lock: deriveLock(preimage), error: "" };
    } catch (error) {
      return { lock: undefined, error: errorMessage(error) };
    }
  }, [preimage]);

  const amountCapacity = useMemo(() => {
    try {
      return parseCkb(amount);
    } catch {
      return -1n;
    }
  }, [amount]);

  const refresh = useCallback(async () => {
    if (!derived.lock) return;
    setRefreshing(true);
    try {
      const [nextCapacity, nextTip] = await Promise.all([
        readCapacity(derived.lock.address),
        readTip(),
      ]);
      setCapacity(nextCapacity);
      setTip(nextTip.toString());
      setNetworkStatus("online");
    } catch (error) {
      setNetworkStatus("offline");
      setMessage(errorMessage(error));
    } finally {
      setRefreshing(false);
    }
  }, [derived.lock]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    let current = true;
    if (!derived.lock || !recipient || capacity <= 0n) {
      setLimits(undefined);
      return;
    }

    void getTransferLimits(derived.lock.address, recipient, capacity)
      .then((nextLimits) => {
        if (current) setLimits(nextLimits);
      })
      .catch((error) => {
        if (current) {
          setLimits(undefined);
          setMessage(errorMessage(error));
        }
      });

    return () => {
      current = false;
    };
  }, [capacity, derived.lock, recipient]);

  useEffect(() => {
    if (
      limits &&
      amountCapacity > limits.maximumTransfer &&
      limits.maximumTransfer >= limits.recipientMinimum
    ) {
      setAmount(formatCkb(limits.maximumTransfer));
    }
  }, [amountCapacity, limits]);

  function selectWitness(mode: WitnessMode) {
    setWitnessMode(mode);
    if (mode === "match") setWitness(preimage);
    if (mode === "mismatch") setWitness(WRONG_PREIMAGE);
  }

  async function copyDepositCommand() {
    if (!derived.lock) return;
    await navigator.clipboard.writeText(
      `offckb deposit --network devnet ${derived.lock.address} 300`,
    );
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  async function submitWitness() {
    if (!derived.lock) return;
    setAttempt("submitting");
    setMessage("Building transaction");
    setTxHash("");

    try {
      const result = await unlock(
        derived.lock.address,
        recipient,
        amount,
        witness,
      );
      setLastTransfer({
        input: result.inputCapacity,
        recipient: result.recipientCapacity,
        change: result.changeCapacity,
        fee: result.fee,
      });
      setTxHash(result.txHash);
      setAttempt("pending");
      setMessage("Waiting for commitment");
      await waitForCommit(result.txHash, (status: TransactionStatus) => {
        setMessage(status === "proposed" ? "Proposed" : "Pending");
      });
      setAttempt("committed");
      setMessage("Committed");
      await refresh();
    } catch (error) {
      setAttempt("rejected");
      setMessage(errorMessage(error));
      await refresh();
    }
  }

  const depositCommand = derived.lock
    ? `offckb deposit --network devnet ${derived.lock.address} 300`
    : "Deploy hash-lock.bc first";
  const canSubmit =
    Boolean(derived.lock) &&
    capacity > 0n &&
    recipient.length > 0 &&
    witness.length > 0 &&
    Boolean(limits) &&
    amountCapacity >= (limits?.recipientMinimum ?? 0n) &&
    amountCapacity <= (limits?.maximumTransfer ?? -1n) &&
    attempt !== "submitting" &&
    attempt !== "pending";

  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand-block">
          <span className="campaign-mark">03</span>
          <div>
            <p className="eyebrow">CKB CELL LIFECYCLE</p>
            <h1>Witness Relay</h1>
          </div>
        </div>
        <div className="runtime-strip" aria-label="Runtime status">
          <span className={`signal ${networkStatus}`}>
            <Activity size={14} /> RPC {networkStatus}
          </span>
          <span className={`signal ${deployment ? "online" : "offline"}`}>
            <ShieldCheck size={14} /> Script {deployment ? "loaded" : "missing"}
          </span>
          <span className="tip">TIP {tip}</span>
        </div>
      </header>

      <section className="identity-strip">
        <div>
          <span className="field-label">NETWORK</span>
          <strong>OFFCKB DEVNET</strong>
        </div>
        <div>
          <span className="field-label">CONTRACT</span>
          <strong>HASH-LOCK.BC</strong>
        </div>
        <div className="identity-wide">
          <span className="field-label">CODE HASH</span>
          <code>{deployment?.codeHash ?? "Awaiting deployment"}</code>
        </div>
      </section>

      <section className="workbench" aria-label="Hash-lock workbench">
        <article className="work-column">
          <div className="column-heading">
            <span>01</span>
            <div>
              <p>DERIVE</p>
              <h2>Lock identity</h2>
            </div>
          </div>
          <label className="control-label" htmlFor="lock-preimage">
            Lock preimage
          </label>
          <input
            id="lock-preimage"
            className="text-input"
            value={preimage}
            onChange={(event) => {
              setPreimage(event.target.value);
              if (witnessMode === "match") setWitness(event.target.value);
            }}
          />
          <div className="data-block">
            <span className="field-label">BLAKE2B-256</span>
            <code>{derived.lock?.digest ?? derived.error}</code>
          </div>
          <div className="data-block grow">
            <span className="field-label">LOCK ADDRESS</span>
            <code>{derived.lock?.address ?? "Unavailable"}</code>
          </div>
        </article>

        <article className="work-column observe-column">
          <div className="column-heading">
            <span>02</span>
            <div>
              <p>OBSERVE</p>
              <h2>Live capacity</h2>
            </div>
          </div>
          <div className="capacity-readout">
            <strong>{formatCkb(capacity)}</strong>
            <span>CKB</span>
          </div>
          <button
            type="button"
            className="secondary-button"
            onClick={() => void refresh()}
            disabled={refreshing || !derived.lock}
          >
            <RefreshCw size={16} className={refreshing ? "spin" : ""} />
            Refresh live cells
          </button>
          <div className="command-block">
            <span className="field-label">OFFCKB DEPOSIT</span>
            <code>{depositCommand}</code>
            <button
              type="button"
              className="icon-button"
              onClick={() => void copyDepositCommand()}
              disabled={!derived.lock}
              title="Copy deposit command"
              aria-label="Copy deposit command"
            >
              {copied ? <Check size={16} /> : <Copy size={16} />}
            </button>
          </div>
        </article>

        <article className="work-column">
          <div className="column-heading">
            <span>03</span>
            <div>
              <p>SPEND</p>
              <h2>Witness attempt</h2>
            </div>
          </div>
          <label className="control-label" htmlFor="recipient">
            Recipient
          </label>
          <input
            id="recipient"
            className="text-input mono-input"
            value={recipient}
            onChange={(event) => setRecipient(event.target.value)}
          />
          <div className="amount-row">
            <div>
              <label className="control-label" htmlFor="amount">
                Capacity
              </label>
              <input
                id="amount"
                className="text-input"
                type="number"
                min={limits ? formatCkb(limits.recipientMinimum) : undefined}
                max={limits ? formatCkb(limits.maximumTransfer) : undefined}
                step="0.00001"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
              />
            </div>
            <span>CKB</span>
          </div>
          <div className="amount-limit" aria-live="polite">
            <span>
              {limits
                ? `MAX ${formatCkb(limits.maximumTransfer)} CKB / CHANGE FLOOR ${formatCkb(limits.changeMinimum)} CKB`
                : "Capacity limits load with a live cell"}
            </span>
            <button
              type="button"
              disabled={
                !limits || limits.maximumTransfer < limits.recipientMinimum
              }
              onClick={() =>
                limits && setAmount(formatCkb(limits.maximumTransfer))
              }
            >
              Use max
            </button>
          </div>
          <div className="segmented" aria-label="Witness mode">
            {(["mismatch", "match", "custom"] as WitnessMode[]).map((mode) => (
              <button
                type="button"
                key={mode}
                className={witnessMode === mode ? "active" : ""}
                onClick={() => selectWitness(mode)}
              >
                {mode}
              </button>
            ))}
          </div>
          <label className="control-label" htmlFor="witness">
            Witness lock
          </label>
          <input
            id="witness"
            className="text-input"
            value={witness}
            onChange={(event) => {
              setWitness(event.target.value);
              setWitnessMode("custom");
            }}
          />
          <button
            type="button"
            className="primary-button"
            disabled={!canSubmit}
            onClick={() => void submitWitness()}
          >
            <Send size={16} /> Submit witness
          </button>
        </article>
      </section>

      <section className="trace-section" aria-labelledby="trace-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow">TRANSACTION TRACE</p>
            <h2 id="trace-title">Cell state transition</h2>
          </div>
          <span className={`attempt-badge ${attempt}`}>
            {attempt === "rejected" ? <X size={14} /> : <Activity size={14} />}
            {message}
          </span>
        </div>
        <div className="trace-grid">
          <div className="trace-node">
            <Database size={18} />
            <span className="field-label">INPUT CELL</span>
            <strong>
              {lastTransfer
                ? formatCkb(lastTransfer.input)
                : formatCkb(capacity)}{" "}
              CKB
            </strong>
            <small>{attempt === "committed" ? "consumed" : "live"}</small>
          </div>
          <ArrowRight className="trace-arrow" />
          <div className={`trace-node witness-node ${attempt}`}>
            <Terminal size={18} />
            <span className="field-label">WITNESS</span>
            <strong>{witnessMode}</strong>
            <small>{compact(witness, 14, 8)}</small>
          </div>
          <ArrowRight className="trace-arrow" />
          <div className="output-stack">
            <div className="trace-node output-node">
              <span className="field-label">RECIPIENT</span>
              <strong>
                {lastTransfer ? formatCkb(lastTransfer.recipient) : amount} CKB
              </strong>
            </div>
            <div className="trace-node output-node">
              <span className="field-label">LOCK CHANGE</span>
              <strong>
                {lastTransfer ? formatCkb(lastTransfer.change) : "pending"}
              </strong>
            </div>
          </div>
        </div>
      </section>

      <section className="ledger" aria-labelledby="ledger-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow">EVENT LEDGER</p>
            <h2 id="ledger-title">Latest attempt</h2>
          </div>
          {lastTransfer && (
            <span className="fee">FEE {formatCkb(lastTransfer.fee)} CKB</span>
          )}
        </div>
        <div className="ledger-row">
          <span>STATUS</span>
          <strong>{attempt.toUpperCase()}</strong>
        </div>
        <div className="ledger-row">
          <span>TX HASH</span>
          <code>{txHash || "No committed transaction"}</code>
        </div>
        <div className="ledger-row">
          <span>WITNESS HASH</span>
          <code>{derived.lock?.digest ?? "Unavailable"}</code>
        </div>
      </section>
    </main>
  );
}
