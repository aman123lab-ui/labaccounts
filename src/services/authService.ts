import { createClient } from '@/lib/supabase/client';
import { postJournalEntry } from '@/services/accountingService';
import { createBatch, getBatches } from '@/services/batchService';
import { Student } from '@/types/database.types';
import { calculatePrintAmount } from '@/config/printingRates';
import { isGuestMode, registerDemoStudentSingle, registerDemoStudentsBulk, getDemoInchargeStaff } from '@/lib/demo/demoStore';

export interface SingleRegistrationInput {
  name: string;
  phone: string;
  password: string;
  batchId: string;
}

export interface BulkRegistrationRowInput {
  name: string;
  batch: string;
  phone: string;
  balance: number;
  password: string;
  // Optional batch category for auto-created batches (General/JD/HS/BS)
  batch_category?: string;
}

export interface BulkRegistrationRowResult {
  rowNumber: number;
  name: string;
  phone: string;
  batch: string;
  balance: number;
  status: 'success' | 'failed';
  error?: string;
}

export interface BulkRegistrationResult {
  totalRows: number;
  successCount: number;
  failureCount: number;
  openingBalancesPosted: number;
  rowResults: BulkRegistrationRowResult[];
}

/**
 * Automatically capitalizes the first letter of every word (Title/Proper case)
 * and trims excess whitespace.
 * e.g. "muhammed anfaz" -> "Muhammed Anfaz"
 */
export function formatStudentName(name: string): string {
  if (!name) return '';
  return name
    .trim()
    .replace(/\s+/g, ' ')
    .split(' ')
    .map((word) => (word ? word.charAt(0).toUpperCase() + word.slice(1).toLowerCase() : ''))
    .join(' ');
}

/**
 * Normalizes phone numbers by removing non-digit characters.
 */
export function normalizePhone(phone: string): string {
  return phone.trim().replace(/\D/g, '');
}

/**
 * Formats student phone into an internal email format for Supabase Auth.
 */
export function studentPhoneToEmail(phone: string): string {
  const clean = normalizePhone(phone);
  return `${clean}@student.lab`;
}

/**
 * Registers a single student:
 * 1. Checks phone uniqueness
 * 2. Creates student in `students` table
 * 3. Creates Supabase Auth user with role: 'student'
 * 4. Creates student's dedicated Accounts Receivable account in `accounts` table (is_student_account = true)
 */
export async function registerStudentSingle(
  input: SingleRegistrationInput
): Promise<{ success: boolean; student?: Student; error?: string }> {
  if (isGuestMode()) {
    return registerDemoStudentSingle(input);
  }

  const supabase = createClient();

  const cleanPhone = normalizePhone(input.phone);
  const cleanName = formatStudentName(input.name);

  if (!cleanPhone) {
    return { success: false, error: 'Valid phone number is required.' };
  }

  if (!cleanName) {
    return { success: false, error: 'Full name is required.' };
  }

  if (!input.password || input.password.length < 6) {
    return { success: false, error: 'Password must be at least 6 characters long.' };
  }

  if (!input.batchId) {
    return { success: false, error: 'Batch selection is required.' };
  }

  // 1. Check phone uniqueness
  const { data: existingStudent } = await supabase
    .from('students')
    .select('id')
    .eq('phone', cleanPhone)
    .maybeSingle();

  if (existingStudent) {
    return { success: false, error: `Phone number '${input.phone}' is already registered.` };
  }

  const studentId = crypto.randomUUID();
  const studentEmail = studentPhoneToEmail(cleanPhone);

  try {
    // 2. Create entry in `students` table
    const { data: studentData, error: studentError } = await ((supabase
      .from('students') as any)
      .insert({
        id: studentId,
        name: cleanName,
        phone: cleanPhone,
        password_hash: input.password, // Stored for app reference
        batch_id: input.batchId,
        status: 'active',
      })
      .select()
      .single() as Promise<{ data: any; error: any }>);

    if (studentError || !studentData) {
      return { success: false, error: `Failed to create student profile: ${studentError?.message}` };
    }

    // 3. Create Supabase Auth User with metadata role: 'student'
    try {
      await fetch('/api/auth/sync-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'student',
          phone: cleanPhone,
          password: input.password,
          name: cleanName,
          studentId: studentId,
        }),
      });
    } catch (authErr) {
      console.warn('Supabase Auth user creation warning (continuing with DB student):', authErr);
      await supabase.auth.signUp({
        email: studentEmail,
        password: input.password,
        options: {
          data: {
            role: 'student',
            phone: cleanPhone,
            name: cleanName,
            student_id: studentId,
          },
        },
      });
    }

    // 4. Create student's dedicated Accounts Receivable account in `accounts` table
    const { error: accountError } = await (supabase
      .from('accounts' as any) as any)
      .insert({
        name: `${cleanName} - Accounts Receivable`,
        type: 'asset',
        is_student_account: true,
        student_id: studentId,
      });

    if (accountError) {
      console.warn('Student AR account creation warning:', accountError.message);
    }

    return { success: true, student: studentData as Student };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Registration failed.';
    return { success: false, error: message };
  }
}

/**
 * Helper to fetch or create Fund Balance / Net Assets account ID.
 */
async function getFundBalanceAccountId(): Promise<string> {
  const supabase = createClient();
  const { data } = await (supabase
    .from('accounts')
    .select('id')
    .eq('type', 'equity')
    .limit(1)
    .maybeSingle() as unknown as Promise<{ data: { id: string } | null; error: any }>);

  if (data?.id) return data.id;

  // Default seed ID fallback
  return '30000000-0000-0000-0000-000000000001';
}

/**
 * Bulk Registers Students from parsed CSV data:
 * - Creates missing batches automatically on the fly
 * - Pre-validates duplicate phone numbers within CSV and against database
 * - Validates required fields (name, phone, password, batch)
 * - Auto-creates student row, auth user, and dedicated AR account
 * - If non-zero opening balance is provided: posts opening balance journal entry
 * - Returns row-by-row results with clear errors
 */
export async function registerStudentsBulk(
  rows: BulkRegistrationRowInput[]
): Promise<BulkRegistrationResult> {
  if (isGuestMode()) {
    return registerDemoStudentsBulk(rows);
  }

  const supabase = createClient();
  const rowResults: BulkRegistrationRowResult[] = [];
  let successCount = 0;
  let failureCount = 0;
  let openingBalancesPosted = 0;

  // Pre-validate CSV duplicate phones within the file itself
  const phoneCounts = new Map<string, number>();
  rows.forEach((r) => {
    const p = normalizePhone(r.phone || '');
    if (p) {
      phoneCounts.set(p, (phoneCounts.get(p) || 0) + 1);
    }
  });

  // Load existing batches and existing phone numbers
  const existingBatches = await getBatches();
  const batchMap = new Map<string, string>(); // name.toLowerCase() -> id
  existingBatches.forEach((b) => batchMap.set(b.name.toLowerCase().trim(), b.id));

  const { data: existingStudentsData } = await (supabase.from('students').select('phone') as unknown as Promise<{ data: Array<{ phone: string }> | null; error: any }>);
  const existingPhones = new Set<string>((existingStudentsData || []).map((s) => s.phone));

  const fundBalanceAccountId = await getFundBalanceAccountId();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 1;
    const cleanPhone = normalizePhone(row.phone || '');
    const cleanName = formatStudentName(row.name || '');
    const cleanBatchName = (row.batch || '').trim();
    const password = row.password || '';
    const balance = Number(row.balance) || 0;

    // Validation checks
    if (!cleanName) {
      failureCount++;
      rowResults.push({
        rowNumber: rowNum,
        name: row.name || 'N/A',
        phone: row.phone || 'N/A',
        batch: row.batch || 'N/A',
        balance,
        status: 'failed',
        error: 'Missing student name.',
      });
      continue;
    }

    if (!cleanPhone) {
      failureCount++;
      rowResults.push({
        rowNumber: rowNum,
        name: cleanName,
        phone: row.phone || 'N/A',
        batch: cleanBatchName,
        balance,
        status: 'failed',
        error: 'Invalid or missing phone number.',
      });
      continue;
    }

    if ((phoneCounts.get(cleanPhone) || 0) > 1) {
      failureCount++;
      rowResults.push({
        rowNumber: rowNum,
        name: cleanName,
        phone: cleanPhone,
        batch: cleanBatchName,
        balance,
        status: 'failed',
        error: `Duplicate phone number '${cleanPhone}' found within the CSV file.`,
      });
      continue;
    }

    if (existingPhones.has(cleanPhone)) {
      failureCount++;
      rowResults.push({
        rowNumber: rowNum,
        name: cleanName,
        phone: cleanPhone,
        batch: cleanBatchName,
        balance,
        status: 'failed',
        error: `Phone number '${cleanPhone}' is already registered in the system.`,
      });
      continue;
    }

    if (!password || password.length < 4) {
      failureCount++;
      rowResults.push({
        rowNumber: rowNum,
        name: cleanName,
        phone: cleanPhone,
        batch: cleanBatchName,
        balance,
        status: 'failed',
        error: 'Missing or short password (minimum 4 characters).',
      });
      continue;
    }

    if (!cleanBatchName) {
      failureCount++;
      rowResults.push({
        rowNumber: rowNum,
        name: cleanName,
        phone: cleanPhone,
        batch: cleanBatchName,
        balance,
        status: 'failed',
        error: 'Missing batch name.',
      });
      continue;
    }

    try {
      // 1. Resolve or create batch
      let batchId = batchMap.get(cleanBatchName.toLowerCase());
      if (!batchId) {
        const newBatchRes = await createBatch(cleanBatchName, row.batch_category?.trim() || undefined);
        if (newBatchRes.success && newBatchRes.data?.id) {
          batchId = newBatchRes.data.id;
          batchMap.set(cleanBatchName.toLowerCase(), batchId);
        } else {
          throw new Error(`Failed to auto-create batch '${cleanBatchName}'`);
        }
      }

      // 2. Single registration execution for row
      const singleRes = await registerStudentSingle({
        name: cleanName,
        phone: cleanPhone,
        password,
        batchId,
      });

      if (!singleRes.success || !singleRes.student) {
        throw new Error(singleRes.error || 'Failed to insert student row.');
      }

      const studentId = singleRes.student.id;
      existingPhones.add(cleanPhone); // Prevent duplication in subsequent CSV rows

      // 3. Check for non-zero opening balance
      if (balance !== 0) {
        // Fetch created student's AR account
        const { data: accData } = await (supabase
          .from('accounts')
          .select('id')
          .eq('student_id', studentId)
          .single() as unknown as Promise<{ data: { id: string } | null; error: any }>);

        if (accData?.id) {
          const debitAmount = balance > 0 ? balance : 0;
          const creditAmount = balance < 0 ? Math.abs(balance) : 0;

          const postRes = await postJournalEntry(
            [
              { accountId: accData.id, debit: debitAmount, credit: creditAmount },
              { accountId: fundBalanceAccountId, debit: creditAmount, credit: debitAmount },
            ],
            `Opening balance for ${cleanName}`
          );

          if (postRes.success) {
            openingBalancesPosted++;
          } else {
            console.warn(`Opening balance posting failed for ${cleanName}:`, postRes.error);
          }
        }
      }

      successCount++;
      rowResults.push({
        rowNumber: rowNum,
        name: cleanName,
        phone: cleanPhone,
        batch: cleanBatchName,
        balance,
        status: 'success',
      });
    } catch (err: unknown) {
      failureCount++;
      const errMsg = err instanceof Error ? err.message : 'Processing error.';
      rowResults.push({
        rowNumber: rowNum,
        name: cleanName,
        phone: cleanPhone,
        batch: cleanBatchName,
        balance,
        status: 'failed',
        error: errMsg,
      });
    }
  }

  return {
    totalRows: rows.length,
    successCount,
    failureCount,
    openingBalancesPosted,
    rowResults,
  };
}

/**
 * Student Login:
 * Logs in with phone and password.
 */
export async function loginStudent(phone: string, password: string): Promise<{ success: boolean; error?: string }> {
  const supabase = createClient();
  const cleanPhone = normalizePhone(phone);

  if (!cleanPhone || !password) {
    return { success: false, error: 'Please enter phone number and password.' };
  }

  const studentEmail = studentPhoneToEmail(cleanPhone);

  // 1. Fetch matching student from DB first
  const { data: dbStudent } = await (supabase
    .from('students' as any) as any)
    .select('*')
    .eq('phone', cleanPhone)
    .maybeSingle();

  if (!dbStudent) {
    return { success: false, error: 'Student account not found with this phone number.' };
  }

  if (dbStudent.password_hash !== password) {
    return { success: false, error: 'Incorrect phone number or password.' };
  }

  // 2. Attempt Supabase Auth sign in
  let { data, error } = await supabase.auth.signInWithPassword({
    email: studentEmail,
    password,
  });

  if (!error && data.user) {
    if (typeof window !== 'undefined') {
      localStorage.setItem('lab_user_role', 'student');
      localStorage.setItem('lab_student_id', dbStudent.id);
      localStorage.setItem('lab_student_name', dbStudent.name);
      localStorage.setItem('lab_student_phone', dbStudent.phone);
    }
    return { success: true };
  }

  // 3. If Auth sign-in failed but DB password matched, sync via server API route
  try {
    const res = await fetch('/api/auth/sync-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'student',
        phone: cleanPhone,
        password,
        name: dbStudent.name,
        studentId: dbStudent.id,
      }),
    });

    const syncRes = await res.json();
    if (!syncRes.success) {
      return { success: false, error: syncRes.error || 'Student auth sync failed.' };
    }

    const retry = await supabase.auth.signInWithPassword({
      email: studentEmail,
      password,
    });

    if (!retry.error && retry.data.user) {
      if (typeof window !== 'undefined') {
        localStorage.setItem('lab_user_role', 'student');
        localStorage.setItem('lab_student_id', dbStudent.id);
        localStorage.setItem('lab_student_name', dbStudent.name);
        localStorage.setItem('lab_student_phone', dbStudent.phone);
      }
      return { success: true };
    } else if (retry.error) {
      return { success: false, error: retry.error.message };
    }
  } catch (syncErr: unknown) {
    console.error('Error syncing student auth user:', syncErr);
    const msg = syncErr instanceof Error ? syncErr.message : 'Student auth sync failed.';
    return { success: false, error: msg };
  }

  return { success: false, error: error?.message || 'Invalid phone number or password.' };
}

/**
 * Admin Login:
 * Logs in with admin email and password.
 */
export async function loginAdmin(email: string, password: string): Promise<{ success: boolean; error?: string }> {
  const supabase = createClient();
  const cleanEmail = email.trim();

  if (!cleanEmail || !password) {
    return { success: false, error: 'Please enter email and password.' };
  }

  const lowerEmail = cleanEmail.toLowerCase();

  // Reject Student or Workforce credentials from using Admin login form
  if (lowerEmail.endsWith('@student.lab')) {
    return { success: false, error: 'Access denied. Student credentials cannot be used to log in to the Admin portal. Please use the Student Login portal.' };
  }
  if (lowerEmail.includes('incharge')) {
    return { success: false, error: 'Access denied. Workforce credentials cannot be used to log in to the Admin portal. Please use the Workforce Login portal.' };
  }

  // 1. Attempt Supabase Auth sign in
  let { data, error } = await supabase.auth.signInWithPassword({
    email: cleanEmail,
    password,
  });

  if (!error && data.user) {
    const userRole = data.user.user_metadata?.role;
    const isAdmin = userRole === 'admin' || lowerEmail === 'admin@lab.com' || lowerEmail.includes('admin');

    if (!isAdmin || userRole === 'student' || lowerEmail.endsWith('@student.lab') || userRole === 'incharge') {
      await supabase.auth.signOut().catch(() => {});
      clearLocalSession();
      return { success: false, error: 'Access denied. This account does not have Admin privileges. Please use the appropriate login portal.' };
    }

    if (typeof window !== 'undefined') {
      localStorage.setItem('lab_user_role', 'admin');
      localStorage.setItem('lab_admin_email', cleanEmail);
    }
    return { success: true };
  }

  // 2. If Auth sign-in failed, sync via server API route ONLY IF email is admin email
  if (lowerEmail.includes('admin') || lowerEmail === 'admin@lab.com') {
    try {
      const res = await fetch('/api/auth/sync-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'admin',
          email: cleanEmail,
          password,
        }),
      });

      const syncRes = await res.json();
      if (!syncRes.success) {
        return { success: false, error: syncRes.error || 'Admin auth sync failed.' };
      }

      const retry = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });

      if (!retry.error && retry.data.user) {
        const userRole = retry.data.user.user_metadata?.role;
        const isAdmin = userRole === 'admin' || lowerEmail === 'admin@lab.com' || lowerEmail.includes('admin');

        if (!isAdmin) {
          await supabase.auth.signOut().catch(() => {});
          clearLocalSession();
          return { success: false, error: 'Access denied. This account does not have Admin privileges.' };
        }

        if (typeof window !== 'undefined') {
          localStorage.setItem('lab_user_role', 'admin');
          localStorage.setItem('lab_admin_email', cleanEmail);
        }
        return { success: true };
      } else if (retry.error) {
        return { success: false, error: retry.error.message };
      }
    } catch (adminErr: unknown) {
      console.error('Error syncing admin auth user:', adminErr);
      const msg = adminErr instanceof Error ? adminErr.message : 'Admin auth sync failed.';
      return { success: false, error: msg };
    }
  }

  return { success: false, error: error?.message || 'Invalid admin credentials.' };
}

/**
 * Workforce (In-charge) Login:
 * Logs in with Workforce email and password.
 */
export async function loginIncharge(email: string, password: string): Promise<{ success: boolean; error?: string }> {
  const supabase = createClient();
  const cleanEmail = email.trim();

  if (!cleanEmail || !password) {
    return { success: false, error: 'Please enter email and password.' };
  }

  const lowerEmail = cleanEmail.toLowerCase();

  // Reject Admin or Student credentials from using Workforce login form
  if (lowerEmail === 'admin@lab.com' || lowerEmail.includes('admin')) {
    return { success: false, error: 'Access denied. Admin credentials cannot be used to log in to the Workforce portal. Please use the Admin Login portal.' };
  }
  if (lowerEmail.endsWith('@student.lab')) {
    return { success: false, error: 'Access denied. Student credentials cannot be used to log in to the Workforce portal. Please use the Student Login portal.' };
  }

  // 1. Attempt Supabase Auth sign in with actual typed credentials
  let { data, error } = await supabase.auth.signInWithPassword({
    email: cleanEmail,
    password,
  });

  if (!error && data.user) {
    const userRole = data.user.user_metadata?.role;
    const userEmail = (data.user.email || cleanEmail).toLowerCase();

    // Verify user has workforce/incharge role
    let isWorkforce = userRole === 'incharge' || userEmail.includes('incharge');
    if (!isWorkforce && userRole !== 'admin' && !userEmail.endsWith('@student.lab')) {
      try {
        const { data: profile } = await (supabase.from('incharge_profiles') as any)
          .select('id')
          .or(`user_id.eq.${data.user.id},email.eq.${userEmail}`)
          .maybeSingle();
        if (profile) {
          isWorkforce = true;
        }
      } catch (pErr) {
        console.warn('Profile check error:', pErr);
      }
    }

    if (!isWorkforce || userRole === 'admin' || userRole === 'student' || userEmail === 'admin@lab.com') {
      await supabase.auth.signOut().catch(() => {});
      clearLocalSession();
      return { success: false, error: 'Access denied. This account does not have Workforce privileges. Please use the appropriate login portal.' };
    }

    if (typeof window !== 'undefined') {
      localStorage.setItem('lab_user_role', 'incharge');
      localStorage.setItem('lab_incharge_email', cleanEmail);
    }
    return { success: true };
  }

  // 2. If Auth sign-in failed, sync via server API route ONLY IF registered in incharge_profiles or email includes 'incharge'
  try {
    const { data: existingProfile } = await (supabase.from('incharge_profiles') as any)
      .select('id')
      .eq('email', lowerEmail)
      .maybeSingle();

    if (!existingProfile && !lowerEmail.includes('incharge')) {
      return { success: false, error: error?.message || 'Invalid Workforce credentials.' };
    }

    const res = await fetch('/api/auth/sync-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'incharge',
        email: cleanEmail,
        password,
      }),
    });

    const syncRes = await res.json();
    if (!syncRes.success) {
      return { success: false, error: syncRes.error || 'Workforce auth sync failed.' };
    }

    const retry = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password,
    });

    if (!retry.error && retry.data.user) {
      const userRole = retry.data.user.user_metadata?.role;
      const userEmail = (retry.data.user.email || cleanEmail).toLowerCase();
      let isWorkforce = userRole === 'incharge' || userEmail.includes('incharge') || !!existingProfile;

      if (!isWorkforce || userRole === 'admin' || userRole === 'student') {
        await supabase.auth.signOut().catch(() => {});
        clearLocalSession();
        return { success: false, error: 'Access denied. This account does not have Workforce privileges.' };
      }

      if (typeof window !== 'undefined') {
        localStorage.setItem('lab_user_role', 'incharge');
        localStorage.setItem('lab_incharge_email', cleanEmail);
      }
      return { success: true };
    } else if (retry.error) {
      return { success: false, error: retry.error.message };
    }
  } catch (inchargeErr: unknown) {
    console.error('Error syncing incharge auth user:', inchargeErr);
    const msg = inchargeErr instanceof Error ? inchargeErr.message : 'Workforce auth sync failed.';
    return { success: false, error: msg };
  }

  return { success: false, error: error?.message || 'Invalid Workforce credentials.' };
}

export interface SessionUserInfo {
  authenticated: boolean;
  role: 'admin' | 'student' | 'incharge' | null;
  userId?: string;
  name?: string;
  userName?: string;
  studentId?: string;
  studentName?: string;
  studentPhone?: string;
  adminEmail?: string;
  inchargeEmail?: string;
  inchargeName?: string;
  staffId?: string;
}

/**
 * Clears active session credentials stored in localStorage.
 */
export function clearLocalSession(): void {
  const ls = typeof window !== 'undefined' ? window.localStorage : undefined;
  if (ls) {
    try {
      ls.removeItem('lab_user_role');
      ls.removeItem('lab_student_id');
      ls.removeItem('lab_student_name');
      ls.removeItem('lab_student_phone');
      ls.removeItem('lab_admin_email');
      ls.removeItem('lab_incharge_email');
      ls.removeItem('lab_incharge_name');
      ls.removeItem('lab_incharge_staff_id');

      // Disable auto-login flags so logged out users don't auto-re-login
      ls.setItem('remember_student', 'false');
      ls.setItem('remember_admin', 'false');
      ls.setItem('remember_incharge', 'false');

      // Clean up any lingering Supabase auth keys from localStorage if present
      for (let i = ls.length - 1; i >= 0; i--) {
        const key = ls.key(i);
        if (key && (key.startsWith('sb-') || key.startsWith('supabase.'))) {
          ls.removeItem(key);
        }
      }
    } catch {
      // Ignore localStorage access issues if any
    }
  }
}

/**
 * Verifies Supabase Auth session & resolves role + user details on app load or navigation.
 */
export async function getValidSessionUser(): Promise<SessionUserInfo> {
  if (isGuestMode()) {
    let guestRole: 'admin' | 'student' | 'incharge' = 'admin';
    if (typeof window !== 'undefined') {
      const storedRole = sessionStorage.getItem('guest_role') || localStorage.getItem('lab_user_role');
      if (storedRole === 'student' || storedRole === 'incharge' || storedRole === 'admin') {
        guestRole = storedRole;
      }
    }

    if (guestRole === 'student') {
      const demoStudentId = (typeof window !== 'undefined' && localStorage.getItem('lab_student_id')) || 'student-aarav-01';
      const demoStudentName = (typeof window !== 'undefined' && localStorage.getItem('lab_student_name')) || 'Aarav Sharma';
      const demoStudentPhone = (typeof window !== 'undefined' && localStorage.getItem('lab_student_phone')) || '9876543210';

      if (typeof window !== 'undefined') {
        localStorage.setItem('lab_user_role', 'student');
        localStorage.setItem('lab_student_id', demoStudentId);
        localStorage.setItem('lab_student_name', demoStudentName);
        localStorage.setItem('lab_student_phone', demoStudentPhone);
      }

      return {
        authenticated: true,
        role: 'student',
        userId: 'demo-student-user-id',
        studentId: demoStudentId,
        studentName: demoStudentName,
        studentPhone: demoStudentPhone,
      };
    }

    if (guestRole === 'incharge') {
      const demoStaffList = getDemoInchargeStaff();
      const primaryStaff = demoStaffList.find((s) => s.email.toLowerCase() === 'incharge@lab.com') || demoStaffList[0];
      const incName = primaryStaff?.name || 'Yaseen';
      const stId = primaryStaff?.staff_id || '4821';

      if (typeof window !== 'undefined') {
        localStorage.setItem('lab_user_role', 'incharge');
        localStorage.setItem('lab_incharge_email', primaryStaff?.email || 'incharge@lab.com');
        localStorage.setItem('lab_incharge_name', incName);
        localStorage.setItem('lab_incharge_staff_id', stId);
      }

      return {
        authenticated: true,
        role: 'incharge',
        userId: primaryStaff?.user_id || primaryStaff?.id || 'demo-incharge-id',
        inchargeEmail: primaryStaff?.email || 'incharge@lab.com',
        inchargeName: incName,
        staffId: stId,
      };
    }

    // Default: admin role
    if (typeof window !== 'undefined') {
      localStorage.setItem('lab_user_role', 'admin');
      localStorage.setItem('lab_admin_email', 'admin@lab.com');
    }

    return {
      authenticated: true,
      role: 'admin',
      userId: 'demo-admin-user-id',
      adminEmail: 'admin@lab.com',
    };
  }

  const supabase = createClient();

  try {
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();

    if (sessionError || !sessionData.session?.user) {
      clearLocalSession();
      return { authenticated: false, role: null };
    }

    const sessionUser = sessionData.session.user;

    // Determine role
    let role: 'admin' | 'student' | 'incharge' | null = null;
    const metadataRole = sessionUser.user_metadata?.role;
    const userEmail = sessionUser.email || '';

    if (metadataRole === 'incharge' || userEmail.toLowerCase().includes('incharge') || userEmail === 'incharge@lab.com') {
      role = 'incharge';
    } else if (metadataRole === 'admin' || userEmail === 'admin@lab.com' || userEmail.toLowerCase().includes('admin')) {
      role = 'admin';
    } else if (metadataRole === 'student' || userEmail.endsWith('@student.lab') || sessionUser.user_metadata?.student_id) {
      role = 'student';
    } else {
      const localRole = typeof window !== 'undefined' ? localStorage.getItem('lab_user_role') : null;
      if (localRole === 'incharge') role = 'incharge';
      else if (localRole === 'admin') role = 'admin';
      else if (localRole === 'student') role = 'student';
    }

    if (role === 'incharge') {
      let inchargeName = sessionUser.user_metadata?.full_name || sessionUser.user_metadata?.name;
      let staffId = sessionUser.user_metadata?.staff_id;

      // Query incharge_profiles table for profile record
      try {
        const { data: profiles } = await (supabase.from('incharge_profiles') as any)
          .select('name, staff_id')
          .or(`user_id.eq.${sessionUser.id},email.eq.${userEmail}`)
          .limit(1);

        if (profiles && profiles.length > 0) {
          if (profiles[0].name) inchargeName = profiles[0].name;
          if (profiles[0].staff_id) staffId = profiles[0].staff_id;
        }
      } catch (pErr) {
        console.warn('Could not fetch incharge profile:', pErr);
      }

      if (!inchargeName && typeof window !== 'undefined') {
        inchargeName = localStorage.getItem('lab_incharge_name') || 'In-Charge Staff';
      }
      if (!staffId && typeof window !== 'undefined') {
        staffId = localStorage.getItem('lab_incharge_staff_id') || undefined;
      }

      if (!staffId) {
        // Generate random 4-digit ID fallback if still unassigned
        staffId = (1000 + Math.floor(Math.random() * 9000)).toString();
      }

      if (typeof window !== 'undefined') {
        localStorage.setItem('lab_user_role', 'incharge');
        if (userEmail) localStorage.setItem('lab_incharge_email', userEmail);
        if (inchargeName) localStorage.setItem('lab_incharge_name', inchargeName);
        if (staffId) localStorage.setItem('lab_incharge_staff_id', staffId);
      }

      return {
        authenticated: true,
        role: 'incharge',
        userId: sessionUser.id,
        inchargeEmail: userEmail,
        inchargeName: inchargeName || 'In-Charge Staff',
        staffId,
      };
    }

    if (role === 'admin') {
      if (typeof window !== 'undefined') {
        localStorage.setItem('lab_user_role', 'admin');
        if (userEmail) localStorage.setItem('lab_admin_email', userEmail);
      }
      return {
        authenticated: true,
        role: 'admin',
        userId: sessionUser.id,
        adminEmail: userEmail,
      };
    }

    if (role === 'student') {
      let studentId = sessionUser.user_metadata?.student_id;
      let studentName = sessionUser.user_metadata?.name;
      let studentPhone = sessionUser.user_metadata?.phone;

      if (!studentId && typeof window !== 'undefined') {
        studentId = localStorage.getItem('lab_student_id') || undefined;
      }
      if (!studentPhone && typeof window !== 'undefined') {
        studentPhone = localStorage.getItem('lab_student_phone') || undefined;
      }
      if (!studentName && typeof window !== 'undefined') {
        studentName = localStorage.getItem('lab_student_name') || undefined;
      }

      // If studentId still missing, query DB by phone or email
      if (!studentId) {
        const queryPhone = studentPhone || (userEmail.endsWith('@student.lab') ? userEmail.replace('@student.lab', '') : '');
        if (queryPhone) {
          const { data: dbStudent } = await (supabase
            .from('students' as any) as any)
            .select('id, name, phone')
            .eq('phone', queryPhone)
            .maybeSingle();

          if (dbStudent) {
            studentId = dbStudent.id;
            studentName = dbStudent.name;
            studentPhone = dbStudent.phone;
          }
        }
      }

      if (typeof window !== 'undefined') {
        localStorage.setItem('lab_user_role', 'student');
        if (studentId) localStorage.setItem('lab_student_id', studentId);
        if (studentName) localStorage.setItem('lab_student_name', studentName);
        if (studentPhone) localStorage.setItem('lab_student_phone', studentPhone);
      }

      return {
        authenticated: true,
        role: 'student',
        userId: sessionUser.id,
        studentId: studentId || '',
        studentName: studentName || 'Student',
        studentPhone: studentPhone || (userEmail.endsWith('@student.lab') ? userEmail.replace('@student.lab', '') : ''),
      };
    }

    // Fallback if role cannot be determined but user session is active
    const fallbackRole = typeof window !== 'undefined' ? (localStorage.getItem('lab_user_role') as 'admin' | 'student' | 'incharge' | null) : null;
    if (fallbackRole === 'admin' || fallbackRole === 'student' || fallbackRole === 'incharge') {
      return {
        authenticated: true,
        role: fallbackRole,
        userId: sessionUser.id,
        adminEmail: fallbackRole === 'admin' ? userEmail : undefined,
        inchargeEmail: fallbackRole === 'incharge' ? userEmail : undefined,
      };
    }

    clearLocalSession();
    return { authenticated: false, role: null };
  } catch (err) {
    console.error('Error verifying auth session:', err);
    clearLocalSession();
    return { authenticated: false, role: null };
  }
}

/**
 * Signs out current user and clears session state.
 */
export async function logoutUser(): Promise<void> {
  const supabase = createClient();
  await supabase.auth.signOut().catch(() => {});
  clearLocalSession();
}

