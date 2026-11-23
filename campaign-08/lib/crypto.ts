export type EncryptedPayload = {
  ciphertext: `0x${string}`;
  iv: `0x${string}`;
};

export const toHex = (bytes: Uint8Array) =>
  `0x${Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('')}` as `0x${string}`;

export const fromHex = (value: string) =>
  Uint8Array.from(value.replace(/^0x/, '').match(/.{2}/g) ?? [], (part) =>
    Number.parseInt(part, 16),
  );

export async function encryptResult(plaintext: string) {
  const keyBytes = crypto.getRandomValues(new Uint8Array(32));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await crypto.subtle.importKey(
    'raw', new Uint8Array(keyBytes), { name: 'AES-GCM' }, false, ['encrypt'],
  );
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv }, key, new TextEncoder().encode(plaintext),
  );
  return {
    key: toHex(keyBytes),
    payload: { ciphertext: toHex(new Uint8Array(ciphertext)), iv: toHex(iv) } satisfies EncryptedPayload,
  };
}

export async function decryptResult(payload: EncryptedPayload, keyHex: string) {
  if (fromHex(keyHex).length !== 32) throw new Error('The decryption key must be 32 bytes.');
  const key = await crypto.subtle.importKey(
    'raw', fromHex(keyHex), { name: 'AES-GCM' }, false, ['decrypt'],
  );
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromHex(payload.iv) },
    key,
    fromHex(payload.ciphertext),
  );
  return new TextDecoder().decode(plaintext);
}

/** Invoice commitment: payment_hash = sha256(payment_preimage). Verifiable with sha256sum. */
export async function sha256Hex(value: string): Promise<`0x${string}`> {
  const digest = await crypto.subtle.digest('SHA-256', fromHex(value));
  return toHex(new Uint8Array(digest));
}
