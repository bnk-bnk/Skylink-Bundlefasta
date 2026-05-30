import bcrypt from 'bcryptjs';
import { createClient } from '../supabase/server';

export async function verifyDashboardPin(userId: string, pin: string): Promise<boolean> {
  const supabase = await createClient();
  
  const { data, error } = await supabase
    .from('dashboard_pin')
    .select('pin_hash')
    .eq('auth_user_id', userId)
    .single();

  if (error || !data) {
    return false;
  }

  return await bcrypt.compare(pin, data.pin_hash);
}

export async function setDashboardPin(userId: string, pin: string): Promise<boolean> {
  const supabase = await createClient();
  const salt = await bcrypt.genSalt(10);
  const pinHash = await bcrypt.hash(pin, salt);

  const { error } = await supabase
    .from('dashboard_pin')
    .upsert({
      auth_user_id: userId,
      pin_hash: pinHash,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'auth_user_id' });

  if (error) {
    console.error('Failed to set PIN:', error);
    return false;
  }

  return true;
}

export async function hasPinConfigured(userId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('dashboard_pin')
    .select('id')
    .eq('auth_user_id', userId)
    .maybeSingle();

  if (error) return false;
  return !!data;
}
