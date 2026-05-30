import { NextResponse } from 'next/server';
import { createTransaction } from '@/lib/repositories/transactions';
import { createAdminClient } from '@/lib/supabase/server';
import { logSystemAudit } from '@/lib/repositories/audit';
import { triggerSettlementRule } from '@/lib/repositories/b2b';

export async function POST(req: Request) {
  try {
    const payload = await req.json();
    console.log('C2B Callback Payload:', JSON.stringify(payload));

    const {
      TransID,
      TransAmount,
      BillRefNumber,
      MSISDN,
      OrgAccountBalance,
      TransactionType,
    } = payload;

    if (!TransID || !TransAmount) {
      return NextResponse.json({ ResultCode: 1, ResultDesc: 'Missing TransID or TransAmount' }, { status: 400 });
    }

    const amount = Number(TransAmount);
    const reference = BillRefNumber ? String(BillRefNumber).trim() : null;
    const phone = MSISDN ? String(MSISDN).trim() : null;

    // Create the incoming C2B transaction
    const transaction = await createTransaction({
      direction: 'IN',
      transaction_type: 'C2B',
      account_reference: reference,
      phone_number: phone,
      amount,
      mpesa_receipt: TransID,
      status: 'SUCCESS',
      description: `C2B PayBill payment - Type: ${TransactionType || 'Pay Bill'}`,
      raw_payload: payload,
    });

    // Trigger settlement rules calculation
    if (transaction && transaction.id) {
      await triggerSettlementRule(transaction.id, transaction.account_reference, transaction.amount);
    }

    // Write a balance snapshot if OrgAccountBalance is available
    if (OrgAccountBalance) {
      const adminSupabase = createAdminClient();
      const currentBalance = Number(OrgAccountBalance);
      
      await adminSupabase
        .from('balance_snapshots')
        .insert({
          balance: currentBalance,
          fetched_at: new Date().toISOString(),
        });
    }

    await logSystemAudit('C2B_PAYMENT_RECEIVED', {
      receipt: TransID,
      amount,
      reference,
      phone,
    });

    return NextResponse.json({ ResultCode: 0, ResultDesc: 'Confirmation received successfully' });
  } catch (error: any) {
    console.error('C2B Callback error:', error);
    return NextResponse.json({ ResultCode: 1, ResultDesc: error.message }, { status: 500 });
  }
}
