import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { logSystemAudit } from '@/lib/repositories/audit';

export async function POST(req: Request) {
  try {
    const payload = await req.json();
    console.log('Account Balance Callback Payload:', JSON.stringify(payload));

    const result = payload?.Result;
    if (!result) {
      return NextResponse.json({ ResultCode: 1, ResultDesc: 'Invalid payload' }, { status: 400 });
    }

    const { ResultCode, ResultDesc, ConversationID } = result;

    if (ResultCode === 0) {
      const params = result.ResultParameters?.ResultParameter || [];
      const balanceParam = params.find((p: any) => p.Key === 'AccountBalance');
      
      if (balanceParam && balanceParam.Value) {
        const balanceStr = String(balanceParam.Value);
        
        // Example: Working Account|KES|700000.00|700000.00|...&Utility Account|KES|228037.00|...
        const accounts = balanceStr.split('&');
        let utilityBalance: number | null = null;
        let workingBalance: number | null = null;

        accounts.forEach((acc) => {
          const parts = acc.split('|');
          if (parts.length >= 3) {
            const accountName = parts[0].trim();
            const availableBalance = Number(parts[2]);

            if (accountName === 'Utility Account') {
              utilityBalance = availableBalance;
            } else if (accountName === 'Working Account') {
              workingBalance = availableBalance;
            }
          }
        });

        // Default to Utility Balance first (most critical for payouts), fallback to Working Account balance
        const finalBalance = utilityBalance !== null ? utilityBalance : (workingBalance !== null ? workingBalance : 0);

        // Insert into balance snapshots
        const adminSupabase = createAdminClient();
        const { data: snapshot, error } = await adminSupabase
          .from('balance_snapshots')
          .insert({
            balance: finalBalance,
            fetched_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (error) throw error;

        await logSystemAudit('BALANCE_CALLBACK_SUCCESS', {
          balance: finalBalance,
          utilityBalance,
          workingBalance,
          conversationId: ConversationID,
          snapshotId: snapshot.id,
        });

        console.log(`Balance snapshot logged successfully: KES ${finalBalance}`);
      }
    } else {
      await logSystemAudit('BALANCE_CALLBACK_FAILED', {
        conversationId: ConversationID,
        resultCode: ResultCode,
        resultDesc: ResultDesc,
      });
    }

    return NextResponse.json({ ResultCode: 0, ResultDesc: 'Success' });
  } catch (error: any) {
    console.error('Account Balance Callback error:', error);
    return NextResponse.json({ ResultCode: 1, ResultDesc: error.message }, { status: 500 });
  }
}
