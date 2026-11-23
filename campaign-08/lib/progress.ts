/** Public lesson progress only. Keys and decrypted content stay out of this cache. */
export const encryptedSessionKey = 'fiber-unlock:progress-v1';
export const buyerProfile = 'fiber-unlock:buyer-v1';
export const sellerProfile = 'fiber-unlock:seller-v1';

type Reader = Pick<Storage, 'getItem'>;

export type EncryptedLessonProgress = {
  version: 1;
  buyerId: string;
  sellerId: string;
  generatedOffer: string;
  buyerOfferText: string;
  attemptedPaymentHash: string;
  triedWithoutKey: boolean;
};

export function savedNodeIdentifier(storage: Reader, key: string): string | null {
  try {
    const profile = JSON.parse(storage.getItem(key) ?? 'null');
    return profile && /^[0-9a-f]{64}$/i.test(profile.fiberKey)
      && /^[0-9a-f]{64}$/i.test(profile.ckbKey)
      && typeof profile.identifier === 'string' && profile.identifier.length > 0
      ? profile.identifier : null;
  } catch { return null; }
}

export function readEncryptedProgress(session: Reader, profiles: Reader): EncryptedLessonProgress | null {
  try {
    const value = JSON.parse(session.getItem(encryptedSessionKey) ?? 'null');
    if (!value || value.version !== 1
      || !value.buyerId || value.buyerId !== savedNodeIdentifier(profiles, buyerProfile)
      || !value.sellerId || value.sellerId !== savedNodeIdentifier(profiles, sellerProfile)
      || typeof value.generatedOffer !== 'string' || typeof value.buyerOfferText !== 'string'
      || typeof value.attemptedPaymentHash !== 'string'
      || (value.attemptedPaymentHash && !/^0x[0-9a-f]{64}$/i.test(value.attemptedPaymentHash))
      || typeof value.triedWithoutKey !== 'boolean') return null;
    // Pick fields explicitly so extra cached secrets are never propagated.
    return {
      version: 1,
      buyerId: value.buyerId,
      sellerId: value.sellerId,
      generatedOffer: value.generatedOffer,
      buyerOfferText: value.buyerOfferText,
      attemptedPaymentHash: value.attemptedPaymentHash,
      triedWithoutKey: value.triedWithoutKey,
    };
  } catch { return null; }
}
