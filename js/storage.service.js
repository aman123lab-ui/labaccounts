/**
 * ============================================================
 * storage.service.js — Data Service Layer (Supabase Migrated)
 * ============================================================
 * ALL data operations are isolated here.
 * This file has been completely migrated to use Supabase database
 * queries instead of localStorage.
 * ============================================================
 */

const SUPABASE_URL = 'https://exwnfnqpuzqrzkjprbji.supabase.co';
const SUPABASE_KEY = 'sb_publishable_HaX6LPhPg1kZ2g1V-7w-3A_13de8qDy';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ── Seed Default Admin ────────────────────────────────────
export async function seedDefaults() {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('role', 'admin')
      .limit(1);

    if (!error && (!data || data.length === 0)) {
      await supabase.from('users').insert([
        {
          name: 'Administrator',
          username: 'admin',
          password: 'admin123',
          role: 'admin',
          createdAt: new Date().toISOString(),
        },
      ]);
    }
  } catch (err) {
    console.error('Seeding error:', err);
  }
}

// ══════════════════════════════════════════════════════════
//  AUTH
// ══════════════════════════════════════════════════════════

export async function loginUser(identifier, password) {
  try {
    // 1. Try to find the user in users table by username and password
    let { data: userData, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('username', identifier)
      .eq('password', password)
      .maybeSingle();

    if (userError) throw userError;

    // 2. If not found, try to find in students table by studentId
    if (!userData) {
      const { data: studentData, error: studentError } = await supabase
        .from('students')
        .select('*')
        .eq('studentId', identifier)
        .maybeSingle();

      if (studentError) throw studentError;

      if (studentData && studentData.userId) {
        const { data: userByStudent, error: userByStudentError } = await supabase
          .from('users')
          .select('*')
          .eq('id', studentData.userId)
          .eq('password', password)
          .maybeSingle();

        if (userByStudentError) throw userByStudentError;
        userData = userByStudent;
      }
    }

    if (!userData) {
      return { data: null, error: 'Invalid Student ID or password.' };
    }

    // Set local storage session
    const session = { ...userData, sessionStart: new Date().toISOString() };
    delete session.password;
    localStorage.setItem('lab_current_user', JSON.stringify(session));
    return { data: session, error: null };
  } catch (err) {
    return { data: null, error: err.message || 'Login failed.' };
  }
}

export function logoutUser() {
  localStorage.removeItem('lab_current_user');
}

export function getCurrentUser() {
  try {
    return JSON.parse(localStorage.getItem('lab_current_user')) ?? null;
  } catch {
    return null;
  }
}

// ══════════════════════════════════════════════════════════
//  STUDENTS
// ══════════════════════════════════════════════════════════

export async function getStudents() {
  try {
    // Sync all users to localStorage to maintain admin.js compatibility for password lookup
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('*');

    if (!usersError && users) {
      localStorage.setItem('lab_users', JSON.stringify(users));
    }

    const { data: students, error: studentsError } = await supabase
      .from('students')
      .select('*');

    if (studentsError) throw studentsError;
    return { data: students, error: null };
  } catch (err) {
    return { data: [], error: err.message };
  }
}

export async function getStudentById(id) {
  try {
    const { data, error } = await supabase
      .from('students')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    if (!data) return { data: null, error: 'Student not found.' };
    return { data, error: null };
  } catch (err) {
    return { data: null, error: err.message };
  }
}

export async function getStudentByUsername(username) {
  try {
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('username', username)
      .eq('role', 'student')
      .maybeSingle();

    if (userError) throw userError;
    if (!user) return { data: null, error: 'Student not found.' };

    const { data: student, error: studentError } = await supabase
      .from('students')
      .select('*')
      .eq('userId', user.id)
      .maybeSingle();

    if (studentError) throw studentError;
    if (!student) return { data: null, error: 'Student record not found.' };

    return { data: { ...student, user }, error: null };
  } catch (err) {
    return { data: null, error: err.message };
  }
}

export async function getStudentByStudentId(studentId) {
  try {
    const { data: student, error: studentError } = await supabase
      .from('students')
      .select('*')
      .eq('studentId', studentId)
      .maybeSingle();

    if (studentError) throw studentError;
    if (!student) return { data: null, error: 'Student not found.' };

    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('id', student.userId)
      .maybeSingle();

    if (userError) throw userError;

    return { data: { ...student, user }, error: null };
  } catch (err) {
    return { data: null, error: err.message };
  }
}

export async function createStudent(studentData) {
  try {
    const studentId = (studentData.studentId || '').trim();
    if (!studentId) return { data: null, error: 'Student ID is required.' };

    // Prevent duplicate Student IDs in students table
    const { data: existingStudent, error: checkStudentErr } = await supabase
      .from('students')
      .select('id')
      .eq('studentId', studentId)
      .maybeSingle();

    if (checkStudentErr) throw checkStudentErr;
    if (existingStudent) {
      return { data: null, error: `Student ID "${studentId}" is already registered.` };
    }

    // Prevent username clash in users table
    const { data: existingUser, error: checkUserErr } = await supabase
      .from('users')
      .select('id')
      .eq('username', studentId)
      .maybeSingle();

    if (checkUserErr) throw checkUserErr;
    if (existingUser) {
      return { data: null, error: `Student ID "${studentId}" is already in use.` };
    }

    // Create the User first
    const newUserData = {
      name: studentData.name,
      username: studentId,
      password: studentData.password || studentId + '123',
      role: 'student',
      createdAt: new Date().toISOString(),
    };
    const { data: createdUser, error: createUserErr } = await supabase
      .from('users')
      .insert([newUserData])
      .select('*')
      .single();

    if (createUserErr) throw createUserErr;

    // Create the Student linked to the created User
    const newStudentData = {
      userId: createdUser.id,
      studentId,
      name: studentData.name,
      batch: studentData.batch || '',
      email: studentData.email || '',
      phone: studentData.phone || '',
      course: studentData.course || '',
      department: studentData.department || '',
      semester: studentData.semester || '',
      totalFee: parseFloat(studentData.totalFee) || 0,
      paidAmount: parseFloat(studentData.paidAmount) || 0,
      account_balance: parseFloat(studentData.account_balance) || 0,
      createdAt: new Date().toISOString(),
    };

    const { data: createdStudent, error: createStudentErr } = await supabase
      .from('students')
      .insert([newStudentData])
      .select('*')
      .single();

    if (createStudentErr) throw createStudentErr;

    // Generate opening-balance ledger entries if account_balance > 0
    const ob = parseFloat(studentData.account_balance) || 0;
    if (ob > 0) {
      const revenueEntry = {
        title: 'Previous Due / Opening Balance',
        source: 'Opening Balance',
        description: 'Opening Balance',
        amount: ob,
        date: new Date().toISOString().split('T')[0],
        notes: `Opening balance for ${createdStudent.name} (${createdStudent.studentId})`,
        createdAt: new Date().toISOString(),
      };
      const { data: createdRevenue, error: revErr } = await supabase
        .from('revenue')
        .insert([revenueEntry])
        .select('*')
        .single();

      if (!revErr && createdRevenue) {
        const newDebit = {
          studentId: createdStudent.id,
          studentName: createdStudent.name,
          description: 'Previous Due / Opening Balance',
          source_description: 'Opening Balance',
          amount: ob,
          balanceAfter: ob,
          revenue_id: createdRevenue.id,
          dueDate: null,
          status: 'pending',
          type: 'debit',
          createdAt: new Date().toISOString(),
          paidAt: null,
        };
        await supabase.from('debits').insert([newDebit]);
      }
    }

    return { data: createdStudent, error: null };
  } catch (err) {
    return { data: null, error: err.message };
  }
}

export async function updateStudent(id, updates) {
  try {
    const { data, error } = await supabase
      .from('students')
      .update({ ...updates, updatedAt: new Date().toISOString() })
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw error;
    return { data, error: null };
  } catch (err) {
    return { data: null, error: err.message };
  }
}

export async function deleteStudent(id) {
  try {
    // 1. Fetch student to get userId
    const { data: student, error: fetchErr } = await supabase
      .from('students')
      .select('userId')
      .eq('id', id)
      .maybeSingle();

    if (fetchErr) throw fetchErr;
    if (!student) return { error: 'Student not found.' };

    // 2. Delete student record
    const { error: delStudentErr } = await supabase
      .from('students')
      .delete()
      .eq('id', id);
    if (delStudentErr) throw delStudentErr;

    // 3. Delete user record
    if (student.userId) {
      const { error: delUserErr } = await supabase
        .from('users')
        .delete()
        .eq('id', student.userId);
      if (delUserErr) throw delUserErr;
    }

    return { error: null };
  } catch (err) {
    return { error: err.message };
  }
}

export async function bulkCreateStudents(studentsArray) {
  const results = { created: [], errors: [] };
  for (const s of studentsArray) {
    const { data, error } = await createStudent(s);
    if (error) results.errors.push({ student: s, error });
    else results.created.push(data);
  }
  return results;
}

// ══════════════════════════════════════════════════════════
//  DEBITS
// ══════════════════════════════════════════════════════════

export async function getDebits(studentId = null) {
  try {
    let query = supabase.from('debits').select('*');
    if (studentId) {
      query = query.eq('studentId', studentId);
    }
    const { data, error } = await query;
    if (error) throw error;
    return { data, error: null };
  } catch (err) {
    return { data: [], error: err.message };
  }
}

export async function addDebit(debitData) {
  try {
    const newDebit = {
      studentId: debitData.studentId,
      studentName: debitData.studentName,
      description: debitData.description,
      amount: parseFloat(debitData.amount),
      dueDate: debitData.dueDate || null,
      status: debitData.status || 'pending',
      createdAt: new Date().toISOString(),
      paidAt: null,
    };
    const { data, error } = await supabase
      .from('debits')
      .insert([newDebit])
      .select('*')
      .single();

    if (error) throw error;
    return { data, error: null };
  } catch (err) {
    return { data: null, error: err.message };
  }
}

export async function updateDebitStatus(debitId, status, paidAmount = null) {
  try {
    const updates = { status };
    if (status === 'paid') {
      updates.paidAt = new Date().toISOString();
    }
    if (paidAmount !== null) {
      updates.paidAmount = parseFloat(paidAmount);
    }
    const { data, error } = await supabase
      .from('debits')
      .update(updates)
      .eq('id', debitId)
      .select('*')
      .single();

    if (error) throw error;
    return { data, error: null };
  } catch (err) {
    return { data: null, error: err.message };
  }
}

export async function deleteDebit(debitId) {
  try {
    const { error } = await supabase
      .from('debits')
      .delete()
      .eq('id', debitId);

    if (error) throw error;
    return { error: null };
  } catch (err) {
    return { error: err.message };
  }
}

// ── Reverse a ledger entry and delete it (Double-Entry safe) ──
export async function reverseAndDeleteEntry(entryId) {
  try {
    // 1. Find the transaction
    const { data: entry, error: fetchErr } = await supabase
      .from('debits')
      .select('*')
      .eq('id', entryId)
      .maybeSingle();

    if (fetchErr) throw fetchErr;
    if (!entry) return { error: 'Transaction not found.' };

    const amt = parseFloat(entry.amount);
    const isDebit = entry.type !== 'credit';
    const isCredit = entry.type === 'credit';

    // 2. Fetch the student to reverse their balance
    const { data: student, error: fetchStudentErr } = await supabase
      .from('students')
      .select('*')
      .eq('id', entry.studentId)
      .maybeSingle();

    if (fetchStudentErr) throw fetchStudentErr;

    if (student) {
      let newBalance = student.account_balance ?? 0;
      let newPaidAmount = student.paidAmount ?? 0;

      if (isDebit) {
        newBalance = newBalance - amt;
      } else {
        newBalance = newBalance + amt;
        newPaidAmount = Math.max(0, newPaidAmount - amt);
      }

      const { error: updateStudentErr } = await supabase
        .from('students')
        .update({
          account_balance: newBalance,
          paidAmount: newPaidAmount,
          updatedAt: new Date().toISOString(),
        })
        .eq('id', entry.studentId);

      if (updateStudentErr) throw updateStudentErr;
    }

    // 3. Remove the linked Revenue entry if it exists
    if (entry.revenue_id) {
      const { error: deleteRevErr } = await supabase
        .from('revenue')
        .delete()
        .eq('id', entry.revenue_id);
      if (deleteRevErr) throw deleteRevErr;
    }

    // 4. Remove the transaction from the ledger
    const { error: deleteDebitErr } = await supabase
      .from('debits')
      .delete()
      .eq('id', entryId);

    if (deleteDebitErr) throw deleteDebitErr;

    return {
      error: null,
      reversed: { type: entry.type, amount: amt, student: entry.studentName },
    };
  } catch (err) {
    return { error: err.message };
  }
}

// ── Apply a Debit to a student ────────────────────────────
export async function applyStudentDebit(studentRecordId, amount, description, printMeta = null) {
  try {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return { error: 'Amount must be greater than zero.' };

    // 1. Fetch student
    const { data: student, error: fetchErr } = await supabase
      .from('students')
      .select('*')
      .eq('id', studentRecordId)
      .maybeSingle();

    if (fetchErr) throw fetchErr;
    if (!student) return { error: 'Student not found.' };

    const newBalance = (student.account_balance ?? 0) + amt;

    // 2. Update student balance
    const { error: updateErr } = await supabase
      .from('students')
      .update({
        account_balance: newBalance,
        updatedAt: new Date().toISOString(),
      })
      .eq('id', studentRecordId);

    if (updateErr) throw updateErr;

    // 3. Record as Revenue first so we can store its id on the ledger entry
    const revenueEntry = {
      title: `Print: ${description || 'Charge'} — ${student.name}`,
      source: 'Student Debit',
      description: 'Print',
      amount: amt,
      date: new Date().toISOString().split('T')[0],
      notes: `Charged to Student ID: ${student.studentId}`,
      createdAt: new Date().toISOString(),
    };
    if (printMeta) {
      revenueEntry.print_type = printMeta.print_type || null;
      revenueEntry.print_side = printMeta.print_side || null;
      revenueEntry.pages = printMeta.pages || null;
    }

    const { data: createdRevenue, error: revErr } = await supabase
      .from('revenue')
      .insert([revenueEntry])
      .select('*')
      .single();

    if (revErr) throw revErr;

    // 4. Record in debits ledger
    const newDebit = {
      studentId: studentRecordId,
      studentName: student.name,
      description: description || 'Debit charge',
      source_description: 'Print',
      amount: amt,
      balanceAfter: newBalance,
      revenue_id: createdRevenue.id,
      dueDate: null,
      status: 'pending',
      type: 'debit',
      createdAt: new Date().toISOString(),
      paidAt: null,
    };
    if (printMeta) {
      newDebit.print_type = printMeta.print_type || null;
      newDebit.print_side = printMeta.print_side || null;
      newDebit.pages = printMeta.pages || null;
    }

    const { data: createdDebit, error: debitErr } = await supabase
      .from('debits')
      .insert([newDebit])
      .select('*')
      .single();

    if (debitErr) throw debitErr;

    return { data: createdDebit, error: null };
  } catch (err) {
    return { error: err.message };
  }
}

// ── Apply a Credit to a student ───────────────────────────
export async function applyStudentCredit(studentRecordId, amount, description) {
  try {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return { error: 'Amount must be greater than zero.' };

    // 1. Fetch student
    const { data: student, error: fetchErr } = await supabase
      .from('students')
      .select('*')
      .eq('id', studentRecordId)
      .maybeSingle();

    if (fetchErr) throw fetchErr;
    if (!student) return { error: 'Student not found.' };

    const newBalance = (student.account_balance ?? 0) - amt;
    const newPaidAmount = (student.paidAmount || 0) + amt;

    // 2. Update student balance
    const { error: updateErr } = await supabase
      .from('students')
      .update({
        account_balance: newBalance,
        paidAmount: newPaidAmount,
        updatedAt: new Date().toISOString(),
      })
      .eq('id', studentRecordId);

    if (updateErr) throw updateErr;

    // 3. Record as Revenue
    const revenueEntry = {
      title: `Payment: ${description || 'Credit'} — ${student.name}`,
      source: 'Fee Payment',
      amount: amt,
      date: new Date().toISOString().split('T')[0],
      notes: `Payment received from Student ID: ${student.studentId}`,
      createdAt: new Date().toISOString(),
    };
    const { data: createdRevenue, error: revErr } = await supabase
      .from('revenue')
      .insert([revenueEntry])
      .select('*')
      .single();

    if (revErr) throw revErr;

    // 4. Record in debits ledger
    const newDebit = {
      studentId: studentRecordId,
      studentName: student.name,
      description: description || 'Credit / Payment received',
      amount: amt,
      balanceAfter: newBalance,
      revenue_id: createdRevenue.id,
      dueDate: null,
      status: 'paid',
      type: 'credit',
      createdAt: new Date().toISOString(),
      paidAt: new Date().toISOString(),
    };
    const { data: createdDebit, error: debitErr } = await supabase
      .from('debits')
      .insert([newDebit])
      .select('*')
      .single();

    if (debitErr) throw debitErr;

    // Fetch updated student record to return
    const { data: updatedStudent, error: fetchUpdatedErr } = await supabase
      .from('students')
      .select('*')
      .eq('id', studentRecordId)
      .single();

    if (fetchUpdatedErr) throw fetchUpdatedErr;

    return { data: updatedStudent, error: null };
  } catch (err) {
    return { error: err.message };
  }
}

// ── Apply Student Manual Debit ────────────────────────────
export async function applyStudentManualDebit(studentRecordId, amount, title, dateVal, notes) {
  try {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return { error: 'Amount must be greater than zero.' };

    // 1. Fetch student
    const { data: student, error: fetchErr } = await supabase
      .from('students')
      .select('*')
      .eq('id', studentRecordId)
      .maybeSingle();

    if (fetchErr) throw fetchErr;
    if (!student) return { error: 'Student not found.' };

    const newBalance = (student.account_balance ?? 0) + amt;

    // 2. Update student balance
    const { error: updateErr } = await supabase
      .from('students')
      .update({
        account_balance: newBalance,
        updatedAt: new Date().toISOString(),
      })
      .eq('id', studentRecordId);

    if (updateErr) throw updateErr;

    // 3. Record as Revenue
    const revenueEntry = {
      title: title,
      source: 'Manual Credit',
      description: 'Manual Credit',
      amount: amt,
      date: dateVal || new Date().toISOString().split('T')[0],
      notes: notes ? `${notes} | Student: ${student.studentId}` : `Student: ${student.studentId}`,
      createdAt: new Date().toISOString(),
    };
    const { data: createdRevenue, error: revErr } = await supabase
      .from('revenue')
      .insert([revenueEntry])
      .select('*')
      .single();

    if (revErr) throw revErr;

    // 4. Record in debits ledger
    const newDebit = {
      studentId: studentRecordId,
      studentName: student.name,
      description: title,
      amount: amt,
      balanceAfter: newBalance,
      revenue_id: createdRevenue.id,
      dueDate: null,
      status: 'pending',
      type: 'debit',
      source_description: 'Manual Credit',
      createdAt: new Date().toISOString(),
      paidAt: null,
    };
    const { data: createdDebit, error: debitErr } = await supabase
      .from('debits')
      .insert([newDebit])
      .select('*')
      .single();

    if (debitErr) throw debitErr;

    return { data: createdDebit, error: null };
  } catch (err) {
    return { error: err.message };
  }
}

// ══════════════════════════════════════════════════════════
//  EXPENSES
// ══════════════════════════════════════════════════════════

export async function getExpenses() {
  try {
    const { data, error } = await supabase
      .from('expenses')
      .select('*');

    if (error) throw error;
    return { data, error: null };
  } catch (err) {
    return { data: [], error: err.message };
  }
}

export async function addExpense(expenseData) {
  try {
    const newExpense = {
      title: expenseData.title,
      category: expenseData.category || 'General',
      amount: parseFloat(expenseData.amount),
      date: expenseData.date || new Date().toISOString().split('T')[0],
      notes: expenseData.notes || '',
      createdAt: new Date().toISOString(),
    };
    const { data, error } = await supabase
      .from('expenses')
      .insert([newExpense])
      .select('*')
      .single();

    if (error) throw error;
    return { data, error: null };
  } catch (err) {
    return { data: null, error: err.message };
  }
}

export async function deleteExpense(id) {
  try {
    const { error } = await supabase
      .from('expenses')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return { error: null };
  } catch (err) {
    return { error: err.message };
  }
}

// ══════════════════════════════════════════════════════════
//  REVENUE
// ══════════════════════════════════════════════════════════

export async function getRevenue() {
  try {
    const { data, error } = await supabase
      .from('revenue')
      .select('*');

    if (error) throw error;
    return { data, error: null };
  } catch (err) {
    return { data: [], error: err.message };
  }
}

export async function addRevenue(revenueData) {
  try {
    const newRevenue = {
      title: revenueData.title,
      source: revenueData.source || 'General',
      amount: parseFloat(revenueData.amount),
      date: revenueData.date || new Date().toISOString().split('T')[0],
      notes: revenueData.notes || '',
      createdAt: new Date().toISOString(),
    };
    if (revenueData.description) newRevenue.description = revenueData.description;
    if (revenueData.print_type) newRevenue.print_type = revenueData.print_type;
    if (revenueData.print_side) newRevenue.print_side = revenueData.print_side;
    if (revenueData.pages) newRevenue.pages = revenueData.pages;

    const { data, error } = await supabase
      .from('revenue')
      .insert([newRevenue])
      .select('*')
      .single();

    if (error) throw error;
    return { data, error: null };
  } catch (err) {
    return { data: null, error: err.message };
  }
}

export async function updateRevenue(id, updates) {
  try {
    const { data, error } = await supabase
      .from('revenue')
      .update({ ...updates, updatedAt: new Date().toISOString() })
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw error;
    return { data, error: null };
  } catch (err) {
    return { data: null, error: err.message };
  }
}

export async function deleteRevenue(id) {
  try {
    const { error } = await supabase
      .from('revenue')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return { error: null };
  } catch (err) {
    return { error: err.message };
  }
}

// ══════════════════════════════════════════════════════════
//  REPORTS / AGGREGATES
// ══════════════════════════════════════════════════════════

export async function getFinancialSummary() {
  try {
    const [expensesRes, revenueRes, studentsRes] = await Promise.all([
      supabase.from('expenses').select('amount'),
      supabase.from('revenue').select('amount, source'),
      supabase.from('students').select('totalFee, paidAmount, account_balance'),
    ]);

    if (expensesRes.error) throw expensesRes.error;
    if (revenueRes.error) throw revenueRes.error;
    if (studentsRes.error) throw studentsRes.error;

    const expenses = expensesRes.data || [];
    const revenue = revenueRes.data || [];
    const students = studentsRes.data || [];

    const totalExpenses = expenses.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);

    const CASH_SOURCES = new Set(['direct cash', 'fee payment']);
    const cashRevenue = revenue.filter(r => {
      const src = (r.source || '').toLowerCase();
      return CASH_SOURCES.has(src);
    });
    const totalRevenue = cashRevenue.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);

    const pendingDebits = students
      .filter(s => (s.account_balance ?? 0) > 0)
      .reduce((sum, s) => sum + (parseFloat(s.account_balance) || 0), 0);

    const totalFees = students.reduce((s, st) => s + (parseFloat(st.totalFee) || 0), 0);
    const totalPaid = students.reduce((s, st) => s + (parseFloat(st.paidAmount) || 0), 0);

    return {
      data: {
        totalExpenses,
        totalRevenue,
        netBalance: totalRevenue - totalExpenses,
        totalStudents: students.length,
        totalFees,
        totalPaid,
        outstandingFees: totalFees - totalPaid,
        pendingDebits,
      },
      error: null,
    };
  } catch (err) {
    return { data: null, error: err.message };
  }
}

// ── Update User Password ──────────────────────────────────
export async function updateUserPassword(userId, newPassword) {
  try {
    const { data, error } = await supabase
      .from('users')
      .update({ password: newPassword, updatedAt: new Date().toISOString() })
      .eq('id', userId)
      .select('*')
      .single();

    if (error) throw error;
    return { data, error: null };
  } catch (err) {
    return { data: null, error: err.message };
  }
}
