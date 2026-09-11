import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

// Read .env.local directly
const envFile = fs.readFileSync('.env.local', 'utf8');
const envVars = {};
for (const line of envFile.split('\n')) {
  const trimmed = line.trim();
  if (trimmed && !trimmed.startsWith('#')) {
    const idx = trimmed.indexOf('=');
    if (idx > 0) {
      const key = trimmed.slice(0, idx).trim();
      const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
      envVars[key] = val;
    }
  }
}

const supabaseUrl = envVars['NEXT_PUBLIC_SUPABASE_URL'];
const supabaseKey = envVars['SUPABASE_SERVICE_ROLE_KEY'] || envVars['NEXT_PUBLIC_SUPABASE_ANON_KEY'];

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false }
});

async function runCleanup() {
  console.log('=== STARTING FOREIGN-KEY SAFE STUDENT DELETION ===');

  // 1. Delete print_jobs referencing students
  console.log('1. Deleting print_jobs referencing students...');
  const { data: pjData, error: pjError } = await supabase
    .from('print_jobs')
    .delete()
    .not('student_id', 'is', null)
    .select('id');
  if (pjError) {
    console.error('Error deleting print_jobs:', pjError);
    process.exit(1);
  }
  console.log(`Deleted ${pjData?.length || 0} print_jobs.`);

  // 2. Delete payment_claims referencing students
  console.log('2. Deleting payment_claims referencing students...');
  const { data: pcData, error: pcError } = await supabase
    .from('payment_claims')
    .delete()
    .not('student_id', 'is', null)
    .select('id');
  if (pcError) {
    console.error('Error deleting payment_claims:', pcError);
    process.exit(1);
  }
  console.log(`Deleted ${pcData?.length || 0} payment_claims.`);

  // 3. Check if any journal_entries or lines reference student accounts
  // Find all student accounts
  const { data: studentAccounts, error: saError } = await supabase
    .from('accounts')
    .select('id, name')
    .or('is_student_account.eq.true,student_id.not.is.null');
  if (saError) {
    console.error('Error fetching student accounts:', saError);
    process.exit(1);
  }
  console.log(`Found ${studentAccounts?.length || 0} student accounts.`);
  const studentAccountIds = (studentAccounts || []).map(a => a.id);

  if (studentAccountIds.length > 0) {
    // Check if journal_entry_lines exist for these accounts
    const { data: jelData, error: jelError } = await supabase
      .from('journal_entry_lines')
      .select('id, journal_entry_id')
      .in('account_id', studentAccountIds);
    if (jelError) {
      console.error('Error checking journal lines:', jelError);
      process.exit(1);
    }
    if (jelData && jelData.length > 0) {
      console.log(`Deleting ${jelData.length} journal entry lines associated with student accounts...`);
      const { error: delJelErr } = await supabase
        .from('journal_entry_lines')
        .delete()
        .in('account_id', studentAccountIds);
      if (delJelErr) {
        console.error('Error deleting journal lines:', delJelErr);
        process.exit(1);
      }
    }

    // 4. Delete student accounts
    console.log('4. Deleting student accounts from accounts table...');
    const { data: delSaData, error: delSaError } = await supabase
      .from('accounts')
      .delete()
      .in('id', studentAccountIds)
      .select('id');
    if (delSaError) {
      console.error('Error deleting student accounts:', delSaError);
      process.exit(1);
    }
    console.log(`Deleted ${delSaData?.length || 0} student accounts.`);
  }

  // 5. Delete students
  console.log('5. Deleting all rows from students table...');
  const { data: delStudents, error: delStudentsError } = await supabase
    .from('students')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000') // Deletes all valid UUID rows
    .select('id');
  if (delStudentsError) {
    console.error('Error deleting students:', delStudentsError);
    process.exit(1);
  }
  console.log(`Deleted ${delStudents?.length || 0} students.`);

  // 6. Verification
  console.log('\n=== POST-CLEANUP VERIFICATION ===');
  const { count: remainingStudents } = await supabase.from('students').select('*', { count: 'exact', head: true });
  const { count: remainingStudentAccounts } = await supabase.from('accounts').select('*', { count: 'exact', head: true }).or('is_student_account.eq.true,student_id.not.is.null');
  const { count: remainingCoreAccounts } = await supabase.from('accounts').select('*', { count: 'exact', head: true }).eq('is_student_account', false);
  const { count: remainingBatches } = await supabase.from('batches').select('*', { count: 'exact', head: true });
  const { count: remainingPrintJobs } = await supabase.from('print_jobs').select('*', { count: 'exact', head: true });

  console.log(`Remaining Students: ${remainingStudents} (Expected: 0)`);
  console.log(`Remaining Student AR Accounts: ${remainingStudentAccounts} (Expected: 0)`);
  console.log(`Remaining Core Accounts: ${remainingCoreAccounts} (Expected: 9+)`);
  console.log(`Remaining Batches: ${remainingBatches} (Expected: 15+)`);
  console.log(`Remaining Print Jobs: ${remainingPrintJobs} (Expected: 0)`);

  console.log('=== CLEANUP FINISHED SUCCESSFULLY ===');
}

runCleanup().catch(err => {
  console.error('Unexpected failure during cleanup:', err);
  process.exit(1);
});
