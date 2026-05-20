import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SECRET_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

export interface ValidationParams {
  amount: number;
  destinationShortcode: string;
  confirmationPassword?: string;
}

export async function validateB2CTopup(params: ValidationParams): Promise<{ valid: boolean; error?: string }> {
  const { amount, destinationShortcode, confirmationPassword } = params;

  // 1. Basic format validations
  if (amount <= 0) {
    return { valid: false, error: 'Amount must be a positive number.' };
  }

  const shortcodeRegex = /^\d{5,7}$/;
  if (!shortcodeRegex.test(destinationShortcode)) {
    return { valid: false, error: 'Destination shortcode must be 5 to 7 digits.' };
  }

  // 2. Fetch safety configs and limits from the credentials database
  const { data: credentials, error: credError } = await supabase
    .from('mpesa_credentials')
    .select('*')
    .eq('id', 'c1111111-1111-1111-1111-111111111111')
    .maybeSingle();

  if (credError) {
    console.error('[Validation B2C Topup] Error loading safety settings:', credError);
  }

  // Load from database first, fallback to environment variables, then default limits
  const maxTxLimit = credentials?.treasury_max_transaction_limit 
    ? Number(credentials.treasury_max_transaction_limit) 
    : Number(process.env.TREASURY_MAX_TRANSACTION_LIMIT || 100000);

  const dailyLimit = credentials?.treasury_daily_limit 
    ? Number(credentials.treasury_daily_limit) 
    : Number(process.env.TREASURY_DAILY_LIMIT || 500000);

  const cooldownSeconds = credentials?.treasury_cooldown_seconds 
    ? Number(credentials.treasury_cooldown_seconds) 
    : Number(process.env.TREASURY_COOLDOWN_SECONDS || 60);

  const requiredPassword = credentials?.treasury_confirmation_password 
    ? credentials.treasury_confirmation_password 
    : process.env.TREASURY_CONFIRMATION_PASSWORD;

  // 3. Verify single transaction limit
  if (amount > maxTxLimit) {
    return { 
      valid: false, 
      error: `Transaction amount KES ${amount.toLocaleString()} exceeds the maximum allowed limit of KES ${maxTxLimit.toLocaleString()}.` 
    };
  }

  // 4. Verify optional confirmation password if set
  if (requiredPassword && requiredPassword !== confirmationPassword) {
    return { valid: false, error: 'Invalid confirmation password.' };
  }

  // 5. Verify daily cumulative limit
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const { data: todayTxs, error: sumError } = await supabase
    .from('b2c_account_topups')
    .select('amount')
    .not('status', 'in', '("failed", "cancelled", "reversed")')
    .gte('created_at', startOfDay.toISOString());

  if (sumError) {
    console.error('[Validation B2C Topup] Error retrieving daily transaction sum:', sumError);
  } else {
    const todaySum = (todayTxs || []).reduce((acc, curr) => acc + Number(curr.amount), 0);
    if (todaySum + amount > dailyLimit) {
      return { 
        valid: false, 
        error: `Daily treasury top-up limit of KES ${dailyLimit.toLocaleString()} would be exceeded. (Topped up today: KES ${todaySum.toLocaleString()}, requested: KES ${amount.toLocaleString()})` 
      };
    }
  }

  // 6. Verify rate limiting / cooldown protection
  const cooldownLimit = new Date(Date.now() - cooldownSeconds * 1000);
  const { data: recentTxs, error: recentError } = await supabase
    .from('b2c_account_topups')
    .select('id')
    .eq('destination_shortcode', destinationShortcode)
    .eq('amount', amount)
    .not('status', 'eq', 'failed')
    .gte('created_at', cooldownLimit.toISOString());

  if (recentError) {
    console.error('[Validation B2C Topup] Error checking cooldown:', recentError);
  } else if (recentTxs && recentTxs.length > 0) {
    return { 
      valid: false, 
      error: `Cooldown protection active: A similar top-up to shortcode ${destinationShortcode} for KES ${amount.toLocaleString()} was initiated in the last ${cooldownSeconds} seconds. Please wait before retrying.` 
    };
  }

  return { valid: true };
}
