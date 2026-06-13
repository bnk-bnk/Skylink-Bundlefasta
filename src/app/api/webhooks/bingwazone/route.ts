import { NextResponse } from 'next/server';
import { verifyWebhookHmac } from '@/lib/webhooks/verify-hmac';
import { reconcileWebhookTransaction } from '@/lib/services/reconciliation';
import { normalizeKenyanPhone } from '@/lib/utils/phone';
import { logSystemAudit } from '@/lib/repositories/audit';

export async function POST(req: Request) {
  try {
    const signature = req.headers.get('X-BingwaZone-Signature');
    const eventHeader = req.headers.get('X-BingwaZone-Event');

    if (!signature || !eventHeader) {
      await logSystemAudit('WEBHOOK_SIGNATURE_REJECTED', {
        source_system: 'bingwazone',
        reason: 'Missing signature or event header'
      });
      return new NextResponse('Missing required headers', { status: 401 });
    }

    // Read raw body exactly once for timing safe verification
    const rawBody = await req.text();
    const secret = process.env.BINGWAZONE_WEBHOOK_SECRET;

    if (!verifyWebhookHmac(rawBody, signature, secret, 'bingwazone')) {
      await logSystemAudit('WEBHOOK_SIGNATURE_REJECTED', {
        source_system: 'bingwazone',
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
    const schemaVersion = payload.schema_version;
    const eventType = payload.event;
    const sourceSystem = payload.source_system;

    if (sourceSystem !== 'bingwazone') {
      return new NextResponse('Invalid source_system', { status: 400 });
    }

    // 2. Validate header event category matches payload event
    // Header format: payment:<uuid>:completed OR wallet-withdrawal:<uuid>:completed
    const eventParts = eventHeader.split(':');
    if (eventParts.length !== 3) {
      return new NextResponse('Invalid X-BingwaZone-Event header format', { status: 400 });
    }

    const [headerCategory, headerId, headerAction] = eventParts;
    if (headerAction !== 'completed') {
      return new NextResponse('Unsupported event action', { status: 400 });
    }

    if (headerCategory === 'payment' && eventType !== 'payment.completed') {
      return new NextResponse('Header category and payload event type mismatch', { status: 400 });
    }

    if (headerCategory === 'wallet-withdrawal' && eventType !== 'wallet.withdrawal.completed') {
      return new NextResponse('Header category and payload event type mismatch', { status: 400 });
    }

    // 3. Process events
    if (eventType === 'payment.completed') {
      const payment = payload.payment;
      if (!payment || !payment.id || !payment.amount || payment.amount <= 0) {
        return new NextResponse('Invalid payment object details', { status: 400 });
      }

      if (payment.id !== headerId) {
        return new NextResponse('Header ID and payment ID mismatch', { status: 400 });
      }

      // Normalize phones
      let normalizedPayerPhone = null;
      let normalizedRecipientPhone = null;
      try {
        if (payment.payer_phone) {
          normalizedPayerPhone = normalizeKenyanPhone(payment.payer_phone);
        }
        if (payment.recipient_phone) {
          normalizedRecipientPhone = normalizeKenyanPhone(payment.recipient_phone);
        }
      } catch (phoneErr: any) {
        return new NextResponse(`Phone normalization failed: ${phoneErr.message}`, { status: 400 });
      }

      const receipt = payment.receipt ? String(payment.receipt).trim().toUpperCase() : null;

      const result = await reconcileWebhookTransaction({
        source_system: 'bingwazone',
        event_key: eventHeader,
        event_type: eventType,
        schema_version: schemaVersion || null,
        raw_payload_string: rawBody,
        raw_payload: payload,
        occurred_at: payload.occurred_at || null,
        tx_direction: 'IN', // payment.completed is money received (IN)
        tx_type: payment.type || 'C2B',
        payment_type: payment.type || 'subscription',
        product_stream: payment.module || 'mini_site',
        module: payment.module || 'mini_site',
        service_source: payment.service_source || 'mini_site_subscription',
        amount: Number(payment.amount),
        payer_phone: normalizedPayerPhone,
        recipient_phone: normalizedRecipientPhone,
        receipt,
        external_reference_id: payment.id,
        agent_name: payload.agent?.name || null,
        agent_business_name: payload.agent?.business_name || null,
        agent_username: payload.agent?.username || null,
        external_agent_id: payload.agent?.id || null,
        initiated_at: payment.initiated_at || null,
        completed_at: payment.completed_at || null,
        metadata: payment.metadata || {}
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

    } else if (eventType === 'wallet.withdrawal.completed') {
      const withdrawal = payload.withdrawal;
      if (!withdrawal || !withdrawal.id || !withdrawal.amount || withdrawal.amount <= 0) {
        return new NextResponse('Invalid withdrawal object details', { status: 400 });
      }

      if (withdrawal.id !== headerId) {
        return new NextResponse('Header ID and withdrawal ID mismatch', { status: 400 });
      }

      // Normalize phone
      let normalizedPhone = null;
      try {
        if (withdrawal.destination) {
          normalizedPhone = normalizeKenyanPhone(withdrawal.destination);
        }
      } catch (phoneErr: any) {
        return new NextResponse(`Phone normalization failed: ${phoneErr.message}`, { status: 400 });
      }

      const receipt = withdrawal.provider_reference || withdrawal.transaction_id || null;

      const result = await reconcileWebhookTransaction({
        source_system: 'bingwazone',
        event_key: eventHeader,
        event_type: eventType,
        schema_version: schemaVersion || null,
        raw_payload_string: rawBody,
        raw_payload: payload,
        occurred_at: payload.occurred_at || null,
        tx_direction: 'OUT', // withdrawal is outgoing payout (OUT)
        tx_type: 'wallet_withdrawal',
        payment_type: 'wallet_withdrawal',
        product_stream: 'wallet',
        module: 'wallet',
        service_source: withdrawal.service_source || 'wallet_withdrawal',
        amount: Number(withdrawal.amount),
        recipient_phone: normalizedPhone,
        receipt,
        external_reference_id: withdrawal.id,
        agent_name: payload.agent?.name || null,
        agent_business_name: payload.agent?.business_name || null,
        agent_username: payload.agent?.username || null,
        external_agent_id: payload.agent?.id || null,
        completed_at: withdrawal.completed_at || null,
        metadata: withdrawal.metadata || {}
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
    }

    return new NextResponse('Unsupported event type', { status: 400 });

  } catch (err: any) {
    console.error('[BingwaZone Webhook Route Error]:', err);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
