import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CHANNEL_CAPACITY, MAX_FEE_AMOUNT, PAYMENT_AMOUNT, REQUIRED_SPENDABLE,
  channelClosed, channelReady, formatCkb, fundingTransaction, parseCkb, samePublicKey, toHex,
} from '../lib/amounts.ts';

test('CKB values retain exact shannon precision', () => {
  assert.equal(parseCkb('0.00000001'), 1n);
  assert.equal(parseCkb('500'), 50_000_000_000n);
  assert.equal(toHex(parseCkb('1')), '0x5f5e100');
  assert.equal(parseCkb('9500.99999536'), 950_099_999_536n);
  assert.equal(formatCkb(950_099_999_536n), '9500.99999536 CKB');
  assert.equal(formatCkb(CHANNEL_CAPACITY), '500 CKB');
});

test('invalid, rounded and overflowing amounts are rejected', () => {
  for (const value of ['', '0', '-1', '1e3', '1.000000001', 'NaN', 'Infinity', '184467440737.09551616']) {
    assert.throws(() => parseCkb(value), value);
  }
});

test('the tutorial economics match the written challenge', () => {
  assert.equal(CHANNEL_CAPACITY, 50_000_000_000n);
  assert.equal(REQUIRED_SPENDABLE, 40_000_000_000n);
  assert.equal(PAYMENT_AMOUNT, 100_000_000n);
  assert.equal(MAX_FEE_AMOUNT, 100_000_000n);
});

test('only the terminal ready state permits payment', () => {
  assert.equal(channelReady('CHANNEL_READY'), true);
  assert.equal(channelReady('ChannelReady'), true);
  for (const value of ['AWAITING_CHANNEL_READY', 'AwaitingChannelReady', 'NEGOTIATING_FUNDING', 'CLOSED', '']) {
    assert.equal(channelReady(value), false, value);
  }
  assert.equal(channelClosed('SHUTTING_DOWN'), true);
});

test('peer matching tolerates the SDK public key prefix', () => {
  assert.equal(samePublicKey('0x02ab', '02AB'), true);
  assert.equal(samePublicKey('02ab', '03ab'), false);
});

test('funding links use the transaction hash rather than the full outpoint', () => {
  const hash = `0x${'ab'.repeat(32)}`;
  assert.equal(fundingTransaction(`${hash}00000000`), hash);
  assert.equal(fundingTransaction({ tx_hash: hash, index: '0x0' }), hash);
  assert.equal(fundingTransaction('not-an-outpoint'), null);
  assert.equal(fundingTransaction(null), null);
});
