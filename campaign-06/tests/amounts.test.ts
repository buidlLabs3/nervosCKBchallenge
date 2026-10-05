import assert from 'node:assert/strict';
import test from 'node:test';
import { parseCkb, formatCkb, toHex, channelReady, samePublicKey, fundingTransaction } from '../lib/amounts.ts';

test('CKB values retain exact shannon precision', () => {
  assert.equal(parseCkb('0.00000001'), 1n);
  assert.equal(parseCkb('499'), 49_900_000_000n);
  assert.equal(toHex(parseCkb('499')), '0xb9e459300');
  assert.equal(parseCkb('9500.99999536'), 950_099_999_536n);
  assert.equal(formatCkb(950_099_999_536n), '9500.99999536 CKB');
  assert.equal(parseCkb('184467440737.09551615'), 0xffffffffffffffffn);
});

test('invalid, rounded, and overflowing payment amounts are rejected', () => {
  for (const value of ['', '0', '-1', '1e3', '1.000000001', 'NaN', 'Infinity', '184467440737.09551616']) {
    assert.throws(() => parseCkb(value), value);
  }
});

test('only the terminal ready state permits payment', () => {
  assert.equal(channelReady('CHANNEL_READY'), true);
  assert.equal(channelReady('ChannelReady'), true);
  for (const value of ['AWAITING_CHANNEL_READY', 'AwaitingChannelReady', 'NEGOTIATING_FUNDING', 'CLOSED', '']) {
    assert.equal(channelReady(value), false, value);
  }
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
