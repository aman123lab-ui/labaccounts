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
    You are an expert full-stack engineer working on our "Lab Accounting System" (Next.js 16, TypeScript, Supabase, Tailwind CSS).

TASK:
Refactor the transaction entry flow in the Workforce / Incharge portal to use a simple, two-mode ledger model: **DEBIT vs CREDIT**.

USER WORKFLOW:
1. When students take prints, the worker adds a **DEBIT** entry (increases student debt / pending balance).
2. When students pay cash, the worker adds a **CREDIT** entry (reduces student debt / settles balance).

---

SPECIFIC REQUIREMENTS:

1. Two-Option Selector at the Top of the Entry Modal:
   - When the worker opens the entry modal (via "+ Log Print Job" or the row "+ Add" button), provide a clear 2-state toggle/tab at the top:
     * `[ 🔴 DEBIT (Print Job) ]`
     * `[ 🟢 CREDIT (Cash Received) ]`

2. If DEBIT is selected (Printing / Service):
   - Shows the student selector (pre-filled if clicked from row).
   - Shows the print item configuration: Single-sided, Double-sided, and Color counts with unit rates.
   - Calculates the Grand Total.
   - On Submission:
     * Creates a DEBIT entry in the student's ledger (Account Receivable).
     * Credits the Printing Revenue account.
     * Increases the student's pending balance.

3. If CREDIT is selected (Cash Payment Received):
   - Shows the student selector (pre-filled if clicked from row).
   - Shows a single straightforward input: **"Amount Paid (₹)"** (along with optional payment reference or date).
   - Shows the student's current outstanding balance for quick reference.
   - On Submission:
     * Creates a CREDIT entry in the student's ledger.
     * Debits the Cash in Hand / Lab Cash account.
     * Reduces the student's pending balance accordingly.

4. UI Feedback:
   - Instantly update the student's balance in the table/cards upon saving either a Debit or Credit entry.
   - Keep the interface fast, clear, and minimal with zero unnecessary steps.

---

EXECUTION:
Update the modal component in `src/app/incharge/` to toggle cleanly between these two modes (DEBIT and CREDIT) with the appropriate double-entry service calls.