/**
 * ============================================================
 * storage.service.js — Data Service Layer (Supabase Migrated)
 * ============================================================
 * ALL data operations are isolated here.
 * This file has been completely migrated to use Supabase database
 * queries instead of localStorage.
 * ============================================================
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://exwnfnqpuzqrzkjprbji.supabase.co';
const SUPABASE_KEY = 'sb_publishable_HaX6LPhPg1kZ2g1V-7w-3A_13de8qDy';
export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Cache variables
export let cachedStudents = null;
export let cachedDebits = null;
export let cachedExpenses = null;
export let cachedRevenue = null;
export let cachedUsers = null;
let initialFetchPromise = null;

export function getCachedExpenses() { return cachedExpenses; }
export function setCachedExpenses(val) { cachedExpenses = val; }

export function getCachedStudents() { return cachedStudents; }
export function setCachedStudents(val) { cachedStudents = val; }

export function getCachedRevenue() { return cachedRevenue; }
export function setCachedRevenue(val) { cachedRevenue = val; }

export function getCachedDebits() { return cachedDebits; }
export function setCachedDebits(val) { cachedDebits = val; }

export function getCachedUsers() { return cachedUsers; }
export function setCachedUsers(val) { cachedUsers = val; }

// Fetch all initial data in parallel
export async function fetchInitialData(forceRefetch = false) {
  if (initialFetchPromise && !forceRefetch) {
    return initialFetchPromise;
  }

  initialFetchPromise = (async () => {
    const [studentsRes, debitsRes, expensesRes, revenueRes] = await Promise.all([
      supabase.from('students').select('*'),
      supabase.from('debits').select('*'),
      supabase.from('expenses').select('*'),
      supabase.from('revenue').select('*'),
    ]);

    if (studentsRes.error) throw studentsRes.error;
    if (debitsRes.error) throw debitsRes.error;
    if (expensesRes.error) throw expensesRes.error;
    if (revenueRes.error) throw revenueRes.error;

    cachedStudents = studentsRes.data || [];
    cachedDebits = debitsRes.data || [];
    cachedExpenses = expensesRes.data || [];
    cachedRevenue = revenueRes.data || [];

    // Fetch users as well to sync to localStorage
    const { data: users, error: usersError } = await supabase.from('users').select('*');
    if (!usersError && users) {
      cachedUsers = users;
      if (typeof window !== 'undefined') {
        localStorage.setItem('lab_users', JSON.stringify(users));
      }
    } else {
      cachedUsers = (typeof window !== 'undefined') ? JSON.parse(localStorage.getItem('lab_users') || '[]') : [];
    }

    return {
      students: cachedStudents,
      debits: cachedDebits,
      expenses: cachedExpenses,
      revenue: cachedRevenue,
      users: cachedUsers
    };
  })();

  return initialFetchPromise;
}

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
    if (typeof window !== 'undefined') {
      localStorage.setItem('lab_current_user', JSON.stringify(session));
      // Set secure cookie for middleware routing (expires in 1 day)
      document.cookie = `lab_role=${userData.role}; path=/; max-age=86400; SameSite=Lax`;
    }
    return { data: session, error: null };
  } catch (err) {
    return { data: null, error: err.message || 'Login failed.' };
  }
}

export function logoutUser() {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('lab_current_user');
    document.cookie = 'lab_role=; path=/; max-age=0; SameSite=Lax';
  }
}

export function getCurrentUser() {
  try {
    if (typeof window === 'undefined') return null;
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
    await fetchInitialData();
    return { data: cachedStudents, error: null };
  } catch (err) {
    return { data: [], error: err.message };
  }
}

export async function getStudentById(id) {
  try {
    await fetchInitialData();
    const student = cachedStudents.find(s => s.id === id);
    if (!student) return { data: null, error: 'Student not found.' };
    return { data: student, error: null };
  } catch (err) {
    return { data: null, error: err.message };
  }
}

export async function getStudentByUsername(username) {
  try {
    await fetchInitialData();
    const user = cachedUsers.find(u => u.username === username && u.role === 'student');
    if (!user) return { data: null, error: 'Student not found.' };
    const student = cachedStudents.find(s => s.userId === user.id);
    if (!student) return { data: null, error: 'Student record not found.' };
    return { data: { ...student, user }, error: null };
  } catch (err) {
    return { data: null, error: err.message };
  }
}

export async function getStudentByStudentId(studentId) {
  try {
    await fetchInitialData();
    const student = cachedStudents.find(s => s.studentId === studentId);
    if (!student) return { data: null, error: 'Student not found.' };
    const user = cachedUsers.find(u => u.id === student.userId);
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
        const { data: createdDebit, error: debitErr } = await supabase
          .from('debits')
          .insert([newDebit])
          .select('*')
          .single();

        if (!debitErr && createdDebit) {
          if (cachedDebits) cachedDebits.push(createdDebit);
          if (cachedRevenue) cachedRevenue.push(createdRevenue);
        }
        await recalculateStudentBalance(createdStudent.id);
      }
    }

    // Update in-memory cache
    if (cachedUsers && !cachedUsers.some(u => u.id === createdUser.id)) cachedUsers.push(createdUser);
    if (cachedStudents && !cachedStudents.some(s => s.id === createdStudent.id)) cachedStudents.push(createdStudent);

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

    if (cachedStudents) {
      const idx = cachedStudents.findIndex(s => s.id === id);
      if (idx !== -1) {
        cachedStudents[idx] = { ...cachedStudents[idx], ...data };
      }
    }

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
      if (cachedUsers) {
        cachedUsers = cachedUsers.filter(u => u.id !== student.userId);
      }
    }

    if (cachedStudents) {
      cachedStudents = cachedStudents.filter(s => s.id !== id);
    }
    return { error: null };
  } catch (err) {
    return { error: err.message };
  }
}

export async function bulkCreateStudents(studentsList) {
  const created = [];
  const errors = [];
  for (const s of studentsList) {
    const { data, error } = await createStudent(s);
    if (error) {
      errors.push({ student: s, error });
    } else {
      created.push(data);
    }
  }
  return { created, errors };
}

export async function getDebits(studentId = null) {
  try {
    await fetchInitialData();
    let data = cachedDebits;
    if (studentId) {
      data = data.filter(d => d.studentId === studentId);
    }
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
      type: debitData.type || 'debit',
      createdAt: new Date().toISOString(),
      paidAt: null,
    };
    if (debitData.revenue_id) newDebit.revenue_id = debitData.revenue_id;
    if (debitData.source_description) newDebit.source_description = debitData.source_description;
    if (debitData.print_type) newDebit.print_type = debitData.print_type;
    if (debitData.print_side) newDebit.print_side = debitData.print_side;
    if (debitData.pages) newDebit.pages = debitData.pages;
    const { data, error } = await supabase
      .from('debits')
      .insert([newDebit])
      .select('*')
      .single();

    if (error) throw error;
    if (cachedDebits) cachedDebits.push(data);
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
    if (cachedDebits) {
      const idx = cachedDebits.findIndex(d => d.id === debitId);
      if (idx !== -1) {
        cachedDebits[idx] = { ...cachedDebits[idx], ...data };
      }
    }
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
    if (cachedDebits) {
      cachedDebits = cachedDebits.filter(d => d.id !== debitId);
    }
    return { error: null };
  } catch (err) {
    return { error: err.message };
  }
}

// ── Recalculate Student Balance from Ledger ────────────────
export async function recalculateStudentBalance(studentRecordId) {
  let debits;
  if (cachedDebits) {
    debits = cachedDebits.filter(d => d.studentId === studentRecordId);
  } else {
    const { data: dbDebits, error: fetchDebitsErr } = await supabase
      .from('debits')
      .select('amount, type')
      .eq('studentId', studentRecordId);
    if (fetchDebitsErr) throw fetchDebitsErr;
    debits = dbDebits || [];
  }

  const newBalance = debits.reduce((sum, d) => {
    const amt = parseFloat(d.amount) || 0;
    return d.type === 'credit' ? sum - amt : sum + amt;
  }, 0);

  const { error: updateStudentErr } = await supabase
    .from('students')
    .update({
      account_balance: newBalance,
      updatedAt: new Date().toISOString(),
    })
    .eq('id', studentRecordId);

  if (updateStudentErr) throw updateStudentErr;

  if (cachedStudents) {
    const idx = cachedStudents.findIndex(s => s.id === studentRecordId);
    if (idx !== -1) {
      cachedStudents[idx].account_balance = newBalance;
      cachedStudents[idx].updatedAt = new Date().toISOString();
    }
  }

  return newBalance;
}

// ── Reverse a ledger entry and delete it (Double-Entry safe) ──
export async function reverseAndDeleteEntry(entryId) {
  try {
    // 1. Find the transaction
    let entry;
    if (cachedDebits) {
      entry = cachedDebits.find(d => d.id === entryId);
    }
    if (!entry) {
      const { data: dbEntry, error: fetchErr } = await supabase
        .from('debits')
        .select('*')
        .eq('id', entryId)
        .maybeSingle();
      if (fetchErr) throw fetchErr;
      entry = dbEntry;
    }
    if (!entry) return { error: 'Transaction not found.' };

    const amt = parseFloat(entry.amount);
    const isCredit = entry.type === 'credit';

    // 2. Fetch the student to reverse their paidAmount if it was a credit
    let student;
    if (cachedStudents) {
      student = cachedStudents.find(s => s.id === entry.studentId);
    }
    if (!student) {
      const { data: dbStudent, error: fetchStudentErr } = await supabase
        .from('students')
        .select('*')
        .eq('id', entry.studentId)
        .maybeSingle();
      if (fetchStudentErr) throw fetchStudentErr;
      student = dbStudent;
    }

    if (student) {
      let newPaidAmount = student.paidAmount ?? 0;
      if (isCredit) {
        newPaidAmount = Math.max(0, newPaidAmount - amt);
      }

      // Update paidAmount on student
      const { error: updateStudentErr } = await supabase
        .from('students')
        .update({
          paidAmount: newPaidAmount,
          updatedAt: new Date().toISOString(),
        })
        .eq('id', entry.studentId);

      if (updateStudentErr) throw updateStudentErr;

      if (cachedStudents) {
        const idx = cachedStudents.findIndex(s => s.id === entry.studentId);
        if (idx !== -1) {
          cachedStudents[idx].paidAmount = newPaidAmount;
          cachedStudents[idx].updatedAt = new Date().toISOString();
        }
      }
    }

    // 3. Remove the linked Revenue entry if it exists
    if (entry.revenue_id) {
      const { error: deleteRevErr } = await supabase
        .from('revenue')
        .delete()
        .eq('id', entry.revenue_id);

      if (deleteRevErr) throw deleteRevErr;
      if (cachedRevenue) {
        cachedRevenue = cachedRevenue.filter(r => r.id !== entry.revenue_id);
      }
    }

    // 4. Remove the transaction from the ledger
    const { error: deleteDebitErr } = await supabase
      .from('debits')
      .delete()
      .eq('id', entryId);

    if (deleteDebitErr) throw deleteDebitErr;
    if (cachedDebits) {
      cachedDebits = cachedDebits.filter(d => d.id !== entryId);
    }

    // 5. Recalculate student balance
    if (student) {
      await recalculateStudentBalance(entry.studentId);
    }

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
    let student;
    if (cachedStudents) {
      student = cachedStudents.find(s => s.id === studentRecordId);
    }
    if (!student) {
      const { data: dbStudent, error: fetchErr } = await supabase
        .from('students')
        .select('*')
        .eq('id', studentRecordId)
        .maybeSingle();
      if (fetchErr) throw fetchErr;
      student = dbStudent;
    }
    if (!student) return { error: 'Student not found.' };

    // 2. Record as Revenue first so we can store its id on the ledger entry
    const isOpening = printMeta && printMeta.print_type === 'opening';
    const revenueEntry = {
      title: isOpening ? `Previous Due / Opening Balance — ${student.name}` : `Print: ${description || 'Charge'} — ${student.name}`,
      source: isOpening ? 'Opening Balance' : 'Student Debit',
      description: isOpening ? 'Opening Balance' : 'Print',
      amount: amt,
      date: new Date().toISOString().split('T')[0],
      notes: isOpening ? `Previous Arrears/Opening Balance for Student ID: ${student.studentId}` : `Charged to Student ID: ${student.studentId}`,
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
    if (cachedRevenue) cachedRevenue.push(createdRevenue);

    // 3. Record in debits ledger
    const newDebit = {
      studentId: studentRecordId,
      studentName: student.name,
      description: description || 'Debit charge',
      source_description: isOpening ? 'Opening Balance' : 'Print',
      amount: amt,
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
    if (cachedDebits) cachedDebits.push(createdDebit);

    // 4. Recalculate student balance
    const finalBalance = await recalculateStudentBalance(studentRecordId);

    // 5. Update the createdDebit's balanceAfter with finalBalance
    const { data: updatedDebit, error: updateDebitErr } = await supabase
      .from('debits')
      .update({ balanceAfter: finalBalance })
      .eq('id', createdDebit.id)
      .select('*')
      .single();

    if (updateDebitErr) throw updateDebitErr;

    if (cachedDebits) {
      const idx = cachedDebits.findIndex(d => d.id === createdDebit.id);
      if (idx !== -1) {
        cachedDebits[idx] = updatedDebit;
      }
    }

    return { data: updatedDebit, error: null };
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
    let student;
    if (cachedStudents) {
      student = cachedStudents.find(s => s.id === studentRecordId);
    }
    if (!student) {
      const { data: dbStudent, error: fetchErr } = await supabase
        .from('students')
        .select('*')
        .eq('id', studentRecordId)
        .maybeSingle();
      if (fetchErr) throw fetchErr;
      student = dbStudent;
    }
    if (!student) return { error: 'Student not found.' };

    const newPaidAmount = (student.paidAmount || 0) + amt;

    // 2. Update student paidAmount
    const { error: updateErr } = await supabase
      .from('students')
      .update({
        paidAmount: newPaidAmount,
        updatedAt: new Date().toISOString(),
      })
      .eq('id', studentRecordId);

    if (updateErr) throw updateErr;
    if (cachedStudents) {
      const idx = cachedStudents.findIndex(s => s.id === studentRecordId);
      if (idx !== -1) {
        cachedStudents[idx].paidAmount = newPaidAmount;
        cachedStudents[idx].updatedAt = new Date().toISOString();
      }
    }

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
    if (cachedRevenue) cachedRevenue.push(createdRevenue);

    // 4. Record in debits ledger
    const newDebit = {
      studentId: studentRecordId,
      studentName: student.name,
      description: description || 'Credit / Payment received',
      amount: amt,
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
    if (cachedDebits) cachedDebits.push(createdDebit);

    // 5. Recalculate student balance
    const finalBalance = await recalculateStudentBalance(studentRecordId);

    // 6. Update debit's balanceAfter
    const { data: updatedDebit, error: updateDebitErr } = await supabase
      .from('debits')
      .update({ balanceAfter: finalBalance })
      .eq('id', createdDebit.id)
      .select('*')
      .single();

    if (!updateDebitErr && updatedDebit && cachedDebits) {
      const idx = cachedDebits.findIndex(d => d.id === createdDebit.id);
      if (idx !== -1) {
        cachedDebits[idx] = updatedDebit;
      }
    }

    // Fetch updated student record to return
    const { data: updatedStudent, error: fetchUpdatedErr } = await supabase
      .from('students')
      .select('*')
      .eq('id', studentRecordId)
      .single();

    if (fetchUpdatedErr) throw fetchUpdatedErr;
    if (cachedStudents) {
      const idx = cachedStudents.findIndex(s => s.id === studentRecordId);
      if (idx !== -1) {
        cachedStudents[idx] = updatedStudent;
      }
    }

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
    let student;
    if (cachedStudents) {
      student = cachedStudents.find(s => s.id === studentRecordId);
    }
    if (!student) {
      const { data: dbStudent, error: fetchErr } = await supabase
        .from('students')
        .select('*')
        .eq('id', studentRecordId)
        .maybeSingle();
      if (fetchErr) throw fetchErr;
      student = dbStudent;
    }
    if (!student) return { error: 'Student not found.' };

    // 2. Record as Revenue
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
    if (cachedRevenue) cachedRevenue.push(createdRevenue);

    // 3. Record in debits ledger
    const newDebit = {
      studentId: studentRecordId,
      studentName: student.name,
      description: title,
      amount: amt,
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

    // 4. Recalculate student balance
    const finalBalance = await recalculateStudentBalance(studentRecordId);

    // 5. Update debit's balanceAfter
    const { data: updatedDebit, error: updateDebitErr } = await supabase
      .from('debits')
      .update({ balanceAfter: finalBalance })
      .eq('id', createdDebit.id)
      .select('*')
      .single();

    if (updateDebitErr) throw updateDebitErr;

    return { data: updatedDebit, error: null };
  } catch (err) {
    return { error: err.message };
  }
}

// ══════════════════════════════════════════════════════════
//  EXPENSES
// ══════════════════════════════════════════════════════════

export async function getExpenses() {
  try {
    await fetchInitialData();
    return { data: cachedExpenses, error: null };
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
    if (cachedExpenses) cachedExpenses.push(data);
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
    if (cachedExpenses) {
      cachedExpenses = cachedExpenses.filter(e => e.id !== id);
    }
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
    await fetchInitialData();
    return { data: cachedRevenue, error: null };
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
    if (cachedRevenue) cachedRevenue.push(data);
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
    if (cachedRevenue) {
      const idx = cachedRevenue.findIndex(r => r.id === id);
      if (idx !== -1) {
        cachedRevenue[idx] = { ...cachedRevenue[idx], ...data };
      }
    }
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
    if (cachedRevenue) {
      cachedRevenue = cachedRevenue.filter(r => r.id !== id);
    }
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
    await fetchInitialData();
    const expenses = cachedExpenses || [];
    const revenue = cachedRevenue || [];
    const students = cachedStudents || [];

    const totalExpenses = expenses.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);

    // 2. Opening Cash Balance
    // Sum of revenue entries where source is 'Opening Cash Balance' or title is 'Opening Cash Balance' (case insensitive)
    const openingCashRevenue = revenue.filter(r => {
      const src = (r.source || '').toLowerCase();
      const title = (r.title || '').toLowerCase();
      return src === 'opening cash balance' || src === 'opening cash' || title === 'opening cash balance';
    });
    const openingCashBalance = openingCashRevenue.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);

    // 3. Total Collected Revenue (Direct Cash & Fee Payment - excluding Opening Cash Balance)
    const CASH_SOURCES = new Set(['direct cash', 'fee payment']);
    const collectedRevenueEntries = revenue.filter(r => {
      const src = (r.source || '').toLowerCase();
      const title = (r.title || '').toLowerCase();
      if (src === 'opening cash balance' || src === 'opening cash' || title === 'opening cash balance') {
        return false;
      }
      return CASH_SOURCES.has(src);
    });
    const totalCollectedRevenue = collectedRevenueEntries.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);

    // 4. Cash in Hand
    const cashInHand = openingCashBalance + totalCollectedRevenue - totalExpenses;

    // 5. Total Pending Debtors (unpaid student debits)
    const pendingDebits = students
      .filter(s => (s.account_balance ?? 0) > 0)
      .reduce((sum, s) => sum + (parseFloat(s.account_balance) || 0), 0);

    // 6. Net Worth / Assets
    const netWorth = cashInHand + pendingDebits;

    const totalFees = students.reduce((s, st) => s + (parseFloat(st.totalFee) || 0), 0);
    const totalPaid = students.reduce((s, st) => s + (parseFloat(st.paidAmount) || 0), 0);

    return {
      data: {
        openingCashBalance,
        totalCollectedRevenue,
        totalExpenses,
        cashInHand,
        pendingDebits,
        netWorth,
        totalStudents: students.length,
        totalFees,
        totalPaid,
        outstandingFees: totalFees - totalPaid,
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
    if (cachedUsers) {
      const idx = cachedUsers.findIndex(u => u.id === userId);
      if (idx !== -1) {
        cachedUsers[idx].password = newPassword;
      }
    }
    return { data, error: null };
  } catch (err) {
    return { data: null, error: err.message };
  }
}

// ── Reset All Financial Data (Danger Zone) ────────────────
export async function resetAllFinancialData() {
  try {
    // 1. Delete all rows from debits table (first due to foreign key references)
    const { error: debErr } = await supabase
      .from('debits')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');
    if (debErr) throw debErr;

    // 2. Delete all rows from revenue table
    const { error: revErr } = await supabase
      .from('revenue')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');
    if (revErr) throw revErr;

    // 3. Delete all rows from expenses table
    const { error: expErr } = await supabase
      .from('expenses')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');
    if (expErr) throw expErr;

    // 4. Reset all student balances to 0
    const { error: studErr } = await supabase
      .from('students')
      .update({ account_balance: 0, updatedAt: new Date().toISOString() })
      .neq('id', '00000000-0000-0000-0000-000000000000');
    if (studErr) throw studErr;

    // Clear caches
    cachedStudents = null;
    cachedDebits = null;
    cachedExpenses = null;
    cachedRevenue = null;
    initialFetchPromise = null;

    return { error: null };
  } catch (err) {
    return { error: err.message };
  }
}

// ── Calculate Opening Balance (Database Query) ────────────
export async function getOpeningBalance(startDate) {
  try {
    const [revRes, expRes] = await Promise.all([
      supabase.from('revenue').select('amount, source').lt('date', startDate),
      supabase.from('expenses').select('amount').lt('date', startDate)
    ]);

    if (revRes.error) throw revRes.error;
    if (expRes.error) throw expRes.error;

    // Filter by cash-basis sources to avoid double counting with unpaid student debits
    const CASH_SOURCES = new Set(['direct cash', 'fee payment', 'opening cash balance', 'opening cash']);
    const totalRev = (revRes.data || [])
      .filter(r => CASH_SOURCES.has((r.source || '').toLowerCase()))
      .reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0);

    const totalExp = (expRes.data || []).reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);

    return { openingBalance: totalRev - totalExp, error: null };
  } catch (err) {
    console.error('Error fetching opening balance:', err);
    return { openingBalance: 0, error: err.message };
  }
}


