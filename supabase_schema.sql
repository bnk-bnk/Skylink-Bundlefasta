-- 1. Create b2b_requests table
CREATE TABLE IF NOT EXISTS public.b2b_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    amount NUMERIC NOT NULL,
    destination_shortcode TEXT NOT NULL,
    destination_type TEXT NOT NULL, -- 'Till' or 'PayBill'
    command_id TEXT NOT NULL, -- 'BusinessBuyGoods' or 'BusinessPayBill'
    account_reference TEXT NOT NULL,
    remarks TEXT,
    conversation_id TEXT,
    originator_conversation_id TEXT,
    result_code INTEGER,
    result_description TEXT,
    status TEXT NOT NULL DEFAULT 'PENDING', -- 'PENDING', 'SUCCESS', 'FAILED', 'TIMEOUT'
    response_payload JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS for b2b_requests
ALTER TABLE public.b2b_requests ENABLE ROW LEVEL SECURITY;

-- Create policies for b2b_requests
CREATE POLICY "Allow all operations for authenticated users" ON public.b2b_requests
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 2. Create settlement_rules table
CREATE TABLE IF NOT EXISTS public.settlement_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_reference TEXT NOT NULL, -- e.g. 'PESATRIX'
    rule_type TEXT NOT NULL, -- 'PERCENTAGE' or 'FIXED'
    percentage NUMERIC, -- e.g. 60.0
    fixed_amount NUMERIC, -- e.g. 50.0
    destination_shortcode TEXT NOT NULL,
    destination_type TEXT NOT NULL, -- 'Till' or 'PayBill'
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS for settlement_rules
ALTER TABLE public.settlement_rules ENABLE ROW LEVEL SECURITY;

-- Create policies for settlement_rules
CREATE POLICY "Allow all operations for authenticated users" ON public.settlement_rules
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 3. Create settlement_queue table
CREATE TABLE IF NOT EXISTS public.settlement_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id UUID REFERENCES public.transactions(id) ON DELETE CASCADE,
    settlement_rule_id UUID REFERENCES public.settlement_rules(id) ON DELETE SET NULL,
    amount NUMERIC NOT NULL,
    status TEXT NOT NULL DEFAULT 'PENDING', -- 'PENDING', 'PROCESSED', 'FAILED'
    attempts INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    processed_at TIMESTAMPTZ
);

-- Enable RLS for settlement_queue
ALTER TABLE public.settlement_queue ENABLE ROW LEVEL SECURITY;

-- Create policies for settlement_queue
CREATE POLICY "Allow all operations for authenticated users" ON public.settlement_queue
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 4. Create sms_notifications table
CREATE TABLE IF NOT EXISTS public.sms_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone TEXT NOT NULL,
    message TEXT NOT NULL,
    message_id TEXT,
    status TEXT NOT NULL DEFAULT 'PENDING', -- 'PENDING', 'SENT', 'FAILED'
    provider_response JSONB,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS for sms_notifications
ALTER TABLE public.sms_notifications ENABLE ROW LEVEL SECURITY;

-- Create policies for sms_notifications
CREATE POLICY "Allow all operations for authenticated users" ON public.sms_notifications
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 5. Create sms_settings table
CREATE TABLE IF NOT EXISTS public.sms_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_alert_phone TEXT NOT NULL DEFAULT '',
    sender_id TEXT NOT NULL DEFAULT '',
    incoming_alerts_enabled BOOLEAN NOT NULL DEFAULT true,
    outgoing_alerts_enabled BOOLEAN NOT NULL DEFAULT true,
    pesafrix_till_number TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS for sms_settings
ALTER TABLE public.sms_settings ENABLE ROW LEVEL SECURITY;

-- Create policies for sms_settings
CREATE POLICY "Allow all operations for authenticated users" ON public.sms_settings
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Seed default settings row if it doesn't exist
INSERT INTO public.sms_settings (id, admin_alert_phone, sender_id, incoming_alerts_enabled, outgoing_alerts_enabled, pesafrix_till_number)
VALUES ('00000000-0000-0000-0000-000000000001', '', '', true, true, '')
ON CONFLICT (id) DO NOTHING;

-- Migration: Add pesafrix_till_number column if not exists
ALTER TABLE public.sms_settings ADD COLUMN IF NOT EXISTS pesafrix_till_number TEXT NOT NULL DEFAULT '';

