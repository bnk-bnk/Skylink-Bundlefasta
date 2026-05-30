import { createClient, createAdminClient } from '../supabase/server';

export async function logAudit(action: string, metadata: any = {}) {
  try {
    const supabase = await createClient();
    
    // Get the current logged-in user
    const { data: { user } } = await supabase.auth.getUser();
    
    // Insert audit log
    const { error } = await supabase
      .from('audit_logs')
      .insert({
        auth_user_id: user?.id || null,
        action,
        metadata: {
          ...metadata,
          operator_email: user?.email || 'unknown',
        },
      });

    if (error) {
      console.error('Audit log insertion failed:', error);
    }
  } catch (e) {
    console.error('Audit logging error:', e);
  }
}

// System logging (webhook callbacks, etc., which don't have cookies context)
export async function logSystemAudit(action: string, metadata: any = {}) {
  try {
    const adminSupabase = createAdminClient();
    
    const { error } = await adminSupabase
      .from('audit_logs')
      .insert({
        auth_user_id: null,
        action,
        metadata,
      });

    if (error) {
      console.error('System Audit log insertion failed:', error);
    }
  } catch (e) {
    console.error('System Audit logging error:', e);
  }
}
