import assert from 'node:assert/strict';
import test from 'node:test';
import { payForOffer, validateOffer } from '../lib/payment.ts';

const hash = `0x${'a'.repeat(64)}` as const;
const offer: any = { invoice: 'fibt-example', paymentHash: hash, lastHop: {} };

function fixture(status = 'Success'): { node: any; calls: string[]; result: any } {
  const calls: string[] = [];
  const result = { status, payment_hash: hash, fee: '0x0' };
  const node: any = {
    parseInvoice: async () => ({ invoice: { currency: 'Fibt', amount: '0x5f5e100', data: { payment_hash: hash } } }),
    sendPayment: async () => { calls.push('send'); return result; },
    getPayment: async () => { calls.push('check'); return result; },
    waitForPayment: async () => result,
  };
  return { node, calls, result };
}

test('mismatched currency, amount or payment hash blocks submission', async () => {
  for (const change of [{ currency: 'Fibb' }, { amount: '0x1' }, { data: { payment_hash: '0xother' } }]) {
    const { node, calls } = fixture();
    const original = node.parseInvoice;
    node.parseInvoice = async () => ({ invoice: { ...(await original()).invoice, ...change } });
    await assert.rejects(validateOffer(node, offer), /does not match/);
    assert.deepEqual(calls, []);
  }
});

test('the attempt is recorded before submission and a storage failure prevents spending', async () => {
  const { node, calls } = fixture();
  await payForOffer(node, offer, '', () => calls.push('record'));
  assert.deepEqual(calls, ['record', 'send']);
  const second = fixture();
  await assert.rejects(
    payForOffer(second.node, offer, '', () => { throw new Error('Storage failed'); }),
    /Storage failed/,
  );
  assert.deepEqual(second.calls, []);
});

test('restored successful and pending payments are checked without resubmission', async () => {
  for (const status of ['Success', 'Inflight']) {
    const { node, calls } = fixture(status);
    await payForOffer(node, offer, hash, () => calls.push('record'), true);
    assert.deepEqual(calls, ['check']);
  }
});

test('retry requires explicit intent and a verified failure', async () => {
  const first = fixture('Failed');
  await payForOffer(first.node, offer, hash, () => first.calls.push('record'));
  assert.deepEqual(first.calls, ['check']);
  const retry = fixture('Failed');
  await payForOffer(retry.node, offer, hash, () => retry.calls.push('record'), true);
  assert.deepEqual(retry.calls, ['check', 'record', 'send']);
  await assert.rejects(payForOffer(retry.node, offer, '0xwrong', () => {}), /previous payment/);
});

test('an expired invoice is rejected before recording or submitting', async () => {
  const { node, calls } = fixture();
  const original = node.parseInvoice;
  node.parseInvoice = async () => ({
    invoice: {
      ...(await original()).invoice,
      data: { payment_hash: hash, timestamp: '0x0', attrs: [{ expiry_time: '0x1' }] },
    },
  });
  await assert.rejects(payForOffer(node, offer, '', () => calls.push('record')), /expired/);
  assert.deepEqual(calls, []);
});

test('a rejected submission clears the attempt so reload does not restore it', async () => {
  const { node } = fixture();
  let saved = JSON.stringify({ attemptedPaymentHash: '' });
  const record = (attemptedPaymentHash: string) => { saved = JSON.stringify({ attemptedPaymentHash }); };
  node.sendPayment = async () => {
    throw new Error(`WASM RPC error: ErrorObject { code: ServerError(-32000), message: ${JSON.stringify('InvalidParameter: Failed to validate payment request: "invoice is expired"')}, data: None }`);
  };
  node.getPayment = async () => {
    throw new Error(`WASM RPC error: ErrorObject { code: ServerError(-32000), message: ${JSON.stringify(`InvalidParameter: Payment session not found: ${hash}`)}, data: None }`);
  };
  await assert.rejects(payForOffer(node, offer, '', record), /Payment was not submitted/);
  assert.equal(JSON.parse(saved).attemptedPaymentHash, '');
});

test('an uncertain send or polling timeout keeps the attempt and never resends it', async () => {
  for (const phase of ['send', 'wait']) {
    const { node, calls } = fixture('Inflight');
    let saved = '';
    const record = (value: string) => { saved = value; };
    if (phase === 'send') node.sendPayment = async () => { calls.push('send'); throw new Error('Worker disconnected'); };
    else node.waitForPayment = async () => { throw new Error('Payment timed out'); };
    await assert.rejects(payForOffer(node, offer, '', record));
    assert.equal(saved, hash);
    await payForOffer(node, offer, saved, record, true);
    assert.deepEqual(calls, ['send', 'check']);
  }
});
