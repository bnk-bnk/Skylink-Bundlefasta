import { NextResponse } from 'next/server';
import crypto from 'crypto';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { phone, amount, reference } = body;

    if (!amount) {
      return NextResponse.json({ error: 'Amount is required' }, { status: 400 });
    }

    const cleanPhone = phone ? phone.trim() : '254708374149';
    const cleanRef = reference ? reference.trim().toUpperCase() : 'PESATRIX';
    const amountVal = Number(amount);

    const mpesaReceipt = `MOCK${crypto.randomBytes(4).toString('hex').toUpperCase()}LN`;

    // Make an internal POST to the actual C2B callback endpoint
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const callbackEndpoint = `${appUrl}/api/daraja/callback/c2b`;

    const c2bPayload = {
      TransactionType: 'Pay Bill',
      TransID: mpesaReceipt,
      TransTime: new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14),
      TransAmount: amountVal.toFixed(2),
      BusinessShortCode: '600638',
      BillRefNumber: cleanRef,
      InvoiceNumber: '',
      OrgAccountBalance: String(200000 + amountVal), // Increment mock balance slightly
      ThirdPartyTransID: '',
      MSISDN: cleanPhone,
      FirstName: 'Simulated',
      MiddleName: 'Customer',
      LastName: '',
    };

    const res = await fetch(callbackEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(c2bPayload),
    });

    if (!res.ok) {
      const errText = await res.text();
      return NextResponse.json({ error: `Callback failed: ${errText}` }, { status: 500 });
    }

    const result = await res.json();
    return NextResponse.json({
      success: true,
      mpesaReceipt,
      callbackResult: result,
    });
  } catch (error: any) {
    console.error('Mock C2B simulation error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
