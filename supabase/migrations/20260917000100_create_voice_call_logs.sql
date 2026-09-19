CREATE TABLE IF NOT EXISTS voice_call_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    phone_number TEXT NOT NULL,
    call_sid TEXT NOT NULL,
    balance_at_call NUMERIC(10, 2) NOT NULL,
    status TEXT NOT NULL DEFAULT 'queued',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS policies
ALTER TABLE voice_call_logs ENABLE ROW LEVEL SECURITY;

-- Allow read/write to authenticated admins/incharges
CREATE POLICY "Enable insert for authenticated users" ON voice_call_logs
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Enable select for authenticated users" ON voice_call_logs
    FOR SELECT USING (auth.role() = 'authenticated');
    