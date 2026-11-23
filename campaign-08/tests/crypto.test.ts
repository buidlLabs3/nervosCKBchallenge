import assert from 'node:assert/strict';
import test from 'node:test';
import { decryptResult, encryptResult, fromHex, sha256Hex, toHex } from '../lib/crypto.ts';

test('a 32-byte key and 12-byte IV round-trip the plaintext exactly', async () => {
  const { key, payload } = await encryptResult('Fiber Testnet report\n\nPayment settled.');
  assert.equal(fromHex(key).length, 32);
  assert.equal(fromHex(payload.iv).length, 12);
  assert.equal(await decryptResult(payload, key), 'Fiber Testnet report\n\nPayment settled.');
});

test('every encryption uses fresh key material and a fresh IV', async () => {
  const first = await encryptResult('same text');
  const second = await encryptResult('same text');
  assert.notEqual(first.key, second.key);
  assert.notEqual(first.payload.iv, second.payload.iv);
  assert.notEqual(first.payload.ciphertext, second.payload.ciphertext);
});

test('a wrong key is rejected by AES-GCM authentication', async () => {
  const { payload } = await encryptResult('locked');
  await assert.rejects(
    decryptResult(payload, `0x${'11'.repeat(32)}`),
    (error: unknown) => error instanceof DOMException && error.name === 'OperationError',
  );
});

test('tampered ciphertext is rejected', async () => {
  const { key, payload } = await encryptResult('locked');
  const bytes = fromHex(payload.ciphertext);
  bytes[0] ^= 0xff;
  await assert.rejects(decryptResult({ ...payload, ciphertext: toHex(bytes) }, key));
});

test('a short key is rejected before decryption', async () => {
  const { payload } = await encryptResult('locked');
  await assert.rejects(decryptResult(payload, '0x1234'), /32 bytes/);
});

test('sha256Hex matches the published SHA-256 vector for "abc"', async () => {
  assert.equal(
    await sha256Hex('0x616263'),
    '0xba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
  );
});

test('the invoice commitment check: sha256(preimage) is stable and 32 bytes', async () => {
  const preimage = `0x${'ab'.repeat(32)}`;
  const first = await sha256Hex(preimage);
  assert.equal(first, await sha256Hex(preimage));
  assert.equal(fromHex(first).length, 32);
  assert.notEqual(first, preimage);
});
