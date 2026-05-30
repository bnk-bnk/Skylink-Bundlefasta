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
