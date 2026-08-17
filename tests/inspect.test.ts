import { describe, it } from 'vitest';
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

describe('Database Inspection & Backup', () => {
  it('should take stock of all tables and backup to file', async () => {
    const backupData: Record<string, any> = {};
    const counts: Record<string, number> = {};

    for (const table of tables) {
      const { data, error } = await supabase
        .from(table)
        .select('*');

      if (error) {
        console.error(`Error querying table ${table}:`, error.message);
        backupData[table] = null;
        counts[table] = 0;
      } else {
        backupData[table] = data;
        counts[table] = data ? data.length : 0;
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

    console.log('=== DB INSPECTION SUMMARY ===');
    console.log(JSON.stringify({ counts, backupPath, latestBackupPath }, null, 2));

    console.log('\n--- BATCHES ---');
    console.log(JSON.stringify(backupData['batches'], null, 2));

    console.log('\n--- FINANCIAL YEARS ---');
    console.log(JSON.stringify(backupData['financial_years'], null, 2));

    console.log('\n--- STUDENTS ---');
    console.log(JSON.stringify(backupData['students'], null, 2));

    console.log('\n--- ACCOUNTS SUMMARY ---');
    const studentAccounts = (backupData['accounts'] || []).filter((a: any) => a.is_student_account || a.student_id);
    const coreAccounts = (backupData['accounts'] || []).filter((a: any) => !a.is_student_account && !a.student_id);
    console.log(`Core Accounts count: ${coreAccounts.length}`);
    console.log(`Student AR Accounts count: ${studentAccounts.length}`);
  });
});
