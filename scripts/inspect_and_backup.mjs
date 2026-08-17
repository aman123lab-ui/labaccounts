import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const supabaseUrl = 'https://rpbgtykecsoigvxjjbsm.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJwYmd0eWtlY3NvaWd2eGpqYnNtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NjAzMDg5MywiZXhwIjoyMTAxNjA2ODkzfQ.IsGAEwJUQEkmIP0GU2KqZD_M8gTw_4yM4p9V1vb-xGs';

const supabase = createClient(supabaseUrl, supabaseKey);

const tables = [
  'students',
  'journal_entries',
  'journal_entry_lines',
  'print_jobs',
  'payment_claims',
  'journal_entry_audit_log',
  'financial_years',
  'batches',
  'accounts'
];

async function inspectAndBackup() {
  console.log('=== TAKING STOCK OF SUPABASE DATABASE TABLES ===\n');
  const backupData = {};
  const counts = {};

  for (const table of tables) {
    const { data, error, count } = await supabase
      .from(table)
      .select('*', { count: 'exact' });

    if (error) {
      console.error(`Error querying table ${table}:`, error.message);
      backupData[table] = null;
      counts[table] = 0;
    } else {
      backupData[table] = data;
      counts[table] = data ? data.length : 0;
      console.log(`Table '${table}': ${counts[table]} rows`);
    }
  }

  // Save backup file
  const backupDir = path.join(process.cwd(), 'backups');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(backupDir, `db_backup_${timestamp}.json`);
  const latestBackupPath = path.join(backupDir, `db_backup_latest.json`);

  fs.writeFileSync(backupPath, JSON.stringify(backupData, null, 2));
  fs.writeFileSync(latestBackupPath, JSON.stringify(backupData, null, 2));

  console.log(`\nFull database backup successfully saved to:\n  - ${backupPath}\n  - ${latestBackupPath}\n`);

  // Detailed analysis
  console.log('--- Batches Breakdown ---');
  if (backupData['batches']) {
    console.table(backupData['batches'].map(b => ({ id: b.id, name: b.name, category: b.category, sort_order: b.sort_order })));
  }

  console.log('\n--- Financial Years Breakdown ---');
  if (backupData['financial_years']) {
    console.table(backupData['financial_years'].map(fy => ({
      id: fy.id,
      name: fy.name,
      start_date: fy.start_date,
      end_date: fy.end_date,
      is_current: fy.is_current,
      closed_at: fy.closed_at
    })));
  }

  console.log('\n--- Students List ---');
  if (backupData['students']) {
    console.table(backupData['students'].map(s => ({ id: s.id, name: s.name, phone: s.phone, status: s.status, batch_id: s.batch_id })));
  }

  console.log('\n--- Accounts Breakdown ---');
  if (backupData['accounts']) {
    const studentAccounts = backupData['accounts'].filter(a => a.is_student_account || a.student_id);
    const coreAccounts = backupData['accounts'].filter(a => !a.is_student_account && !a.student_id);
    console.log(`Total Accounts: ${backupData['accounts'].length} (Core Chart of Accounts: ${coreAccounts.length}, Student AR Accounts: ${studentAccounts.length})`);
    console.log('Core Chart of Accounts:');
    console.table(coreAccounts.map(a => ({ id: a.id, name: a.name, type: a.type })));
    if (studentAccounts.length > 0) {
      console.log('Student Accounts (to be deleted during cleanup):');
      console.table(studentAccounts.map(a => ({ id: a.id, name: a.name, type: a.type, student_id: a.student_id })));
    }
  }
}

inspectAndBackup();
