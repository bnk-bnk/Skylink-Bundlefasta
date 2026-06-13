import { NextResponse } from 'next/server';
import { verifyWebhookHmac } from '@/lib/webhooks/verify-hmac';
import { reconcileWebhookTransaction } from '@/lib/services/reconciliation';
import { normalizeKenyanPhone } from '@/lib/utils/phone';
import { logSystemAudit } from '@/lib/repositories/audit';

export async function POST(req: Request) {
  try {
    const signature = req.headers.get('X-Pesatrix-Signature');
    const eventHeader = req.headers.get('X-Pesatrix-Event');

    if (!signature || !eventHeader) {
      await logSystemAudit('WEBHOOK_SIGNATURE_REJECTED', {
        source_system: 'pesatrix',
        reason: 'Missing signature or event header'
      });
      return new NextResponse('Missing required headers', { status: 401 });
    }

    // Read raw body exactly once for timing safe verification
    const rawBody = await req.text();
    const secret = process.env.PESATRIX_WEBHOOK_SECRET;

    if (!verifyWebhookHmac(rawBody, signature, secret, 'pesatrix')) {
      await logSystemAudit('WEBHOOK_SIGNATURE_REJECTED', {
        source_system: 'pesatrix',
        reason: 'HMAC signature verification failed'
      });
      return new NextResponse('Invalid signature', { status: 401 });
    }

    // Parse JSON only after signature verification
    let payload: any;
    try {
      payload = JSON.parse(rawBody);
    } catch (parseErr) {
      return new NextResponse('Invalid JSON payload', { status: 400 });
    }

    // 1. Basic validation
    const eventType = payload.event;
    const platform = payload.platform;

    if (platform !== 'pesatrix') {
      return new NextResponse('Invalid platform field', { status: 400 });
    }

    if (eventHeader !== eventType) {
      return new NextResponse('Header event type and payload event type mismatch', { status: 400 });
    }

    if (eventType !== 'activation' && eventType !== 'withdrawal') {
      return new NextResponse('Unsupported event type', { status: 400 });
    }

    if (!payload.amount || payload.amount <= 0) {
      return new NextResponse('Invalid or non-positive amount', { status: 400 });
    }

    if (!payload.reference_id || !payload.user_id || !payload.transaction_id) {
      return new NextResponse('Missing required identifier fields', { status: 400 });
    }

    // 2. Normalize phone
    let normalizedPhone = null;
    try {
      if (payload.phone) {
        normalizedPhone = normalizeKenyanPhone(payload.phone);
      }
    } catch (phoneErr: any) {
      return new NextResponse(`Phone normalization failed: ${phoneErr.message}`, { status: 400 });
    }

    const receipt = String(payload.transaction_id).trim().toUpperCase();

    // 3. Generate deterministic event key
    const eventKey = `pesatrix:${eventType}:${payload.reference_id}`;

    // 4. Call reconciliation
    const result = await reconcileWebhookTransaction({
      source_system: 'pesatrix',
      event_key: eventKey,
      event_type: eventType,
      schema_version: null,
      raw_payload_string: rawBody,
      raw_payload: payload,
      occurred_at: payload.timestamp || null,
      tx_direction: eventType === 'activation' ? 'IN' : 'OUT',
      tx_type: eventType === 'activation' ? 'activation' : 'withdrawal',
      payment_type: eventType === 'activation' ? 'activation' : 'withdrawal',
      product_stream: eventType === 'activation' ? 'activation' : 'withdrawal',
      module: eventType === 'activation' ? 'account_activation' : 'wallet',
      service_source: eventType === 'activation' ? 'pesatrix_activation' : 'pesatrix_wallet_withdrawal',
      amount: Number(payload.amount),
      payer_phone: eventType === 'activation' ? normalizedPhone : null,
      recipient_phone: eventType === 'withdrawal' ? normalizedPhone : null,
      receipt,
      external_reference_id: payload.reference_id,
      external_user_id: payload.user_id,
      completed_at: payload.timestamp || null,
      metadata: {
        timestamp: payload.timestamp,
        user_id: payload.user_id
      }
    });

    if (result.status === 'idempotency_conflict') {
      return new NextResponse(result.error, { status: 409 });
    }
    if (result.status === 'error') {
      return new NextResponse(result.error, { status: 500 });
    }

    return NextResponse.json({
      received: true,
      duplicate: result.duplicate
    });

  } catch (err: any) {
    console.error('[Pesatrix Webhook Route Error]:', err);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
