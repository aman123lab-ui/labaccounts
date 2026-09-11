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

async function main() {
  console.log('Fetching all batches...');
  const { data: batches, error } = await supabase.from('batches').select('*');
  if (error) {
    console.error('Error fetching batches:', error);
    process.exit(1);
  }

  console.log('Current batches:', batches.map(b => ({ id: b.id, name: b.name, category: b.category })));

  // Target duplicate spaceless BS batches: 'BS1', 'BS2', 'BS3', 'BS5'
  const duplicateNames = ['BS1', 'BS2', 'BS3', 'BS5'];
  const targets = batches.filter(b => duplicateNames.includes(b.name.trim()));

  console.log('Found target duplicate batches to delete:', targets);

  for (const t of targets) {
    // Check if any students are attached
    const { data: students, error: sErr } = await supabase.from('students').select('id').eq('batch_id', t.id);
    if (sErr) {
      console.error(`Error checking students for batch ${t.name}:`, sErr);
      continue;
    }
    if (students && students.length > 0) {
      console.warn(`Cannot delete ${t.name}: ${students.length} students attached!`);
      continue;
    }

    const { error: delErr } = await supabase.from('batches').delete().eq('id', t.id);
    if (delErr) {
      console.error(`Failed to delete batch ${t.name} (${t.id}):`, delErr);
    } else {
      console.log(`Successfully deleted duplicate batch: ${t.name} (${t.id})`);
    }
  }

  const { data: remaining } = await supabase.from('batches').select('*');
  console.log('Remaining batches after cleanup:', remaining.map(b => ({ id: b.id, name: b.name, category: b.category })));
}

main().catch(err => {
  console.error('Script error:', err);
  process.exit(1);
});
