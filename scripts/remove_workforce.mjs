import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://rpbgtykecsoigvxjjbsm.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJwYmd0eWtlY3NvaWd2eGpqYnNtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NjAzMDg5MywiZXhwIjoyMTAxNjA2ODkzfQ.IsGAEwJUQEkmIP0GU2KqZD_M8gTw_4yM4p9V1vb-xGs';

const supabase = createClient(supabaseUrl, supabaseKey);

async function removeWorkforce() {
  console.log('Fetching all incharge_profiles...');
  const { data: profiles, error: fetchError } = await supabase.from('incharge_profiles').select('*');
  
  if (fetchError) {
    console.error('Failed to fetch incharge_profiles:', fetchError);
    return;
  }
  
  if (!profiles || profiles.length === 0) {
    console.log('No workforce members found in incharge_profiles.');
  } else {
    console.log(`Found ${profiles.length} workforce members. Deleting...`);
    
    // Delete all from incharge_profiles
    const { error: deleteProfilesError } = await supabase.from('incharge_profiles').delete().neq('id', 'dummy'); // match all
    if (deleteProfilesError) {
      console.error('Failed to delete incharge_profiles:', deleteProfilesError);
    } else {
      console.log('Successfully deleted all incharge_profiles.');
    }
    
    // Delete corresponding auth users
    const { data: userListData, error: listError } = await supabase.auth.admin.listUsers();
    if (listError) {
      console.error('Error listing auth users:', listError);
    } else {
      const authUsers = userListData?.users || [];
      for (const p of profiles) {
        if (p.user_id) {
          console.log(`Deleting auth user ${p.user_id}...`);
          await supabase.auth.admin.deleteUser(p.user_id);
        } else {
           const u = authUsers.find(u => u.email?.toLowerCase() === p.email?.toLowerCase());
           if (u) {
              console.log(`Deleting auth user ${u.id}...`);
              await supabase.auth.admin.deleteUser(u.id);
           }
        }
      }
    }
  }

  // Double check auth users with role 'incharge' and delete them too
  console.log('Checking for any leftover auth users with role "incharge"...');
  const { data: userListData2, error: listError2 } = await supabase.auth.admin.listUsers();
  if (userListData2 && userListData2.users) {
      for (const u of userListData2.users) {
          if (u.user_metadata?.role === 'incharge') {
              console.log(`Deleting leftover incharge auth user ${u.id} (${u.email})...`);
              await supabase.auth.admin.deleteUser(u.id);
          }
      }
  }
  
  console.log('Finished removing all existing workforce members.');
}

removeWorkforce();
