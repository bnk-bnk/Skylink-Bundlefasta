import crypto from 'crypto';

/**
 * Timing-safe HMAC-SHA256 signature verification helper.
 * Returns true if the signature is valid, false otherwise.
 * Never logs the secret or exposes expected signatures in exceptions/logs.
 */
export function verifyWebhookHmac(
  rawBody: string,
  signatureHeader: string | null | undefined,
  secret: string | null | undefined,
  format: 'bingwazone' | 'pesatrix'
): boolean {
  if (!secret) {
    console.error(`[HMAC Validation] Error: Secret key is not configured.`);
    return false;
  }

  if (!signatureHeader) {
    return false;
  }

  // Extract raw hex signature based on format rules
  let providedHex = '';
  if (format === 'bingwazone') {
    // Format: sha256=<64 lowercase/uppercase hex characters>
    if (!signatureHeader.startsWith('sha256=')) {
      return false;
    }
    providedHex = signatureHeader.slice(7);
  } else if (format === 'pesatrix') {
    // Format: <64 lowercase/uppercase hex characters>
    providedHex = signatureHeader;
  }

  // Hex format check (exactly 64 hex characters)
  if (!/^[a-fA-F0-9]{64}$/.test(providedHex)) {
    return false;
  }

  try {
    const providedBuffer = Buffer.from(providedHex, 'hex');

    // Compute expected HMAC
    const computedHex = crypto
      .createHmac('sha256', secret)
      .update(rawBody)
      .digest('hex');
    const computedBuffer = Buffer.from(computedHex, 'hex');

    // timingSafeEqual requires buffers of identical length.
    // If they differ, they cannot be equal.
    if (providedBuffer.length !== computedBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(providedBuffer, computedBuffer);
  } catch (err) {
    console.error('[HMAC Validation] Error during Timing-Safe verification:', err);
    return false;
  }
}
