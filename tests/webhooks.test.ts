import { test } from 'node:test';
import assert from 'node:assert';
import crypto from 'crypto';
import { verifyWebhookHmac } from '../src/lib/webhooks/verify-hmac';
import { normalizeKenyanPhone } from '../src/lib/utils/phone';
import { buildAlertMessage } from '../src/lib/notifications/send-transaction-alert';
import { getReadableLabel } from '../src/lib/utils/labels';

const BZ_SECRET = 'test_bz_secret_value_123';
const PT_SECRET = 'test_pt_secret_value_456';

test('HMAC Signature Verification - BingwaZone Format', () => {
  const body = JSON.stringify({ event: 'payment.completed', amount: 500 });
  const signature = 'sha256=' + crypto.createHmac('sha256', BZ_SECRET).update(body).digest('hex');

  // Assert successful verification
  assert.strictEqual(verifyWebhookHmac(body, signature, BZ_SECRET, 'bingwazone'), true);

  // Assert failed verification on wrong secret
  assert.strictEqual(verifyWebhookHmac(body, signature, 'wrong_secret', 'bingwazone'), false);

  // Assert failed verification on malformed header
  assert.strictEqual(verifyWebhookHmac(body, signature.replace('sha256=', ''), BZ_SECRET, 'bingwazone'), false);
});

test('HMAC Signature Verification - Pesatrix Format', () => {
  const body = JSON.stringify({ event: 'activation', amount: 200 });
  const signature = crypto.createHmac('sha256', PT_SECRET).update(body).digest('hex');

  // Assert successful verification
  assert.strictEqual(verifyWebhookHmac(body, signature, PT_SECRET, 'pesatrix'), true);

  // Assert failed verification on modified signature
  assert.strictEqual(verifyWebhookHmac(body, signature + 'f', PT_SECRET, 'pesatrix'), false);
});

test('Kenyan Phone Normalization Rules', () => {
  // 10 digits starting with 0
  assert.strictEqual(normalizeKenyanPhone('0712345678'), '254712345678');
  assert.strictEqual(normalizeKenyanPhone('0112345678'), '254112345678');

  // 9 digits starting with 7 or 1
  assert.strictEqual(normalizeKenyanPhone('712345678'), '254712345678');
  assert.strictEqual(normalizeKenyanPhone('112345678'), '254112345678');

  // 12 digits starting with 254
  assert.strictEqual(normalizeKenyanPhone('254712345678'), '254712345678');
  assert.strictEqual(normalizeKenyanPhone('254112345678'), '254112345678');

  // With plus prefix
  assert.strictEqual(normalizeKenyanPhone('+254712345678'), '254712345678');

  // Failures: invalid lengths and country prefixes
  assert.throws(() => normalizeKenyanPhone('0812345678')); // invalid prefix
  assert.throws(() => normalizeKenyanPhone('071234567'));  // too short
  assert.throws(() => normalizeKenyanPhone('2547123456789')); // too long
});

test('Readable Labels Mappings', () => {
  assert.strictEqual(getReadableLabel('mini_site'), 'Mini Sites');
  assert.strictEqual(getReadableLabel('whatsapp_auto_post'), 'WhatsApp Auto Post');
  assert.strictEqual(getReadableLabel('account_activation'), 'Account Activations');
  assert.strictEqual(getReadableLabel('wallet_withdrawal'), 'Wallet Withdrawal');
  assert.strictEqual(getReadableLabel('some_custom_module_name'), 'Some Custom Module Name');
});

test('Unified Message Templates Generation', () => {
  const incomingParams = {
    transaction_id: 'tx_uuid_123',
    source_system: 'bingwazone',
    direction: 'IN' as const,
    transaction_type: 'payment.completed',
    amount: 1250,
    phone_number: '254712345678',
    mpesa_receipt: 'TFA8765432',
    module: 'mini_site'
  };

  const smsIncoming = buildAlertMessage(incomingParams, 'sms');
  assert.match(smsIncoming, /SKYLINK PAYBILL/);
  assert.match(smsIncoming, /Received KES 1,250\.00/);
  assert.match(smsIncoming, /Source: BingwaZone/);
  assert.match(smsIncoming, /Module: Mini Sites/);
  assert.match(smsIncoming, /Phone: 254712345678/);
  assert.match(smsIncoming, /Receipt: TFA8765432/);

  const waIncoming = buildAlertMessage(incomingParams, 'whatsapp');
  assert.match(waIncoming, /\*SKYLINK PAYBILL ALERT\*/);
  assert.match(waIncoming, /Money received: \*KES 1,250\.00\*/);
});
