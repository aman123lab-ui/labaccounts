import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import {
  getCurrentUser, logoutUser,
  getStudents, createStudent, updateStudent, deleteStudent, bulkCreateStudents,
  getExpenses, addExpense, deleteExpense,
  getRevenue, addRevenue, deleteRevenue, updateRevenue,
  getDebits, updateDebitStatus, reverseAndDeleteEntry,
  applyStudentDebit, applyStudentCredit, applyStudentManualDebit,
  getFinancialSummary, updateUserPassword, getOpeningBalance
} from '../js/storage.service';

export default function AdminPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState(null);
  const [isMounted, setIsMounted] = useState(false);
  const [loading, setLoading] = useState(true);

  // Active section state
  const [activeSection, setActiveSection] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Toasts state
  const [toasts, setToasts] = useState([]);

  // Data states
  const [students, setStudents] = useState([]);
  const [debits, setDebits] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [revenue, setRevenue] = useState([]);
  const [financialSummary, setFinancialSummary] = useState({
    cashInHand: 0,
    totalExpenses: 0,
    pendingDebits: 0,
    netWorth: 0,
    totalStudents: 0,
    totalFees: 0,
    totalPaid: 0,
    outstandingFees: 0,
  });

  // Modal states
  const [activeModal, setActiveModal] = useState(null); // 'reset-modal', 'delete-all-students-modal', 'quick-charge-modal', 'quick-collect-modal', 'debit-modal', 'credit-modal', 'edit-student-modal', 'account-statement-modal', 'revenue-detail-modal', 'dailyStatementModal'
  const [modalStudent, setModalStudent] = useState(null);
  const [modalRevenueEntry, setModalRevenueEntry] = useState(null);
  const [dailyStatementDate, setDailyStatementDate] = useState('');
  const [dailyStatementEntries, setDailyStatementEntries] = useState([]);

  // Search & filter states
  const [studentSearch, setStudentSearch] = useState('');
  const [studentBatchFilter, setStudentBatchFilter] = useState('all');
  const [debtorSearch, setDebtorSearch] = useState('');

  // Dropdown coord state for kebab menus
  const [activeKebabStudentId, setActiveKebabStudentId] = useState(null);
  const [kebabCoords, setKebabCoords] = useState({ top: 0, left: 0 });

  // Form states
  // Add Student
  const [regName, setRegName] = useState('');
  const [regStudentId, setRegStudentId] = useState('');
  const [regBatch, setRegBatch] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regAlert, setRegAlert] = useState(null);
  const [regLoading, setRegLoading] = useState(false);

  // Bulk Register
  const [bulkText, setBulkText] = useState('');
  const [bulkAlert, setBulkAlert] = useState(null);
  const [bulkLoading, setBulkLoading] = useState(false);

  // Add Revenue
  const [revType, setRevType] = useState('Cash');
  const [revStudentId, setRevStudentId] = useState('');
  const [revTitle, setRevTitle] = useState('');
  const [revAmount, setRevAmount] = useState('');
  const [revDate, setRevDate] = useState('');
  const [revNotes, setRevNotes] = useState('');
  const [revAlert, setRevAlert] = useState(null);
  const [revLoading, setRevLoading] = useState(false);

  // Add Expense
  const [expDate, setExpDate] = useState('');
  const [expTitle, setExpTitle] = useState('');
  const [expAmount, setExpAmount] = useState('');
  const [expNotes, setExpNotes] = useState('');
  const [expAlert, setExpAlert] = useState(null);
  const [expLoading, setExpLoading] = useState(false);

  // Quick Charge Form
  const [qcDescription, setQcDescription] = useState('');
  const [qcAmount, setQcAmount] = useState('');
  const [qcAlert, setQcAlert] = useState(null);
  const [qcLoading, setQcLoading] = useState(false);

  // Quick Collect Form
  const [qlDescription, setQlDescription] = useState('');
  const [qlAmount, setQlAmount] = useState('');
  const [qlAlert, setQlAlert] = useState(null);
  const [qlLoading, setQlLoading] = useState(false);

  // Inline Quick Register states
  const [showInlineRegister, setShowInlineRegister] = useState(false);
  const [inlineRegName, setInlineRegName] = useState('');
  const [inlineRegStudentId, setInlineRegStudentId] = useState('');
  const [inlineRegBatch, setInlineRegBatch] = useState('');
  const [inlineRegPhone, setInlineRegPhone] = useState('');
  const [inlineRegPassword, setInlineRegPassword] = useState('');
  const [inlineRegLoading, setInlineRegLoading] = useState(false);
  const [inlineRegAlert, setInlineRegAlert] = useState(null);

  // Password visibility state
  const [visiblePasswords, setVisiblePasswords] = useState({});

  const [debitSearchInput, setDebitSearchInput] = useState('');
  const [debitSelectedStudents, setDebitSelectedStudents] = useState([]);
  const [debitDropdownOpen, setDebitDropdownOpen] = useState(false);
  const [debitType, setDebitType] = useState('bw');
  const [debitSide, setDebitSide] = useState('one');
  const [debitPages, setDebitPages] = useState(1);
  const [debitDiscount, setDebitDiscount] = useState(0);
  const [debitAmount, setDebitAmount] = useState(3);
  const [debitAlert, setDebitAlert] = useState(null);
  const [debitLoading, setDebitLoading] = useState(false);

  // Add Credit Modal Form
  const [creditSearchInput, setCreditSearchInput] = useState('');
  const [creditSelectedStudent, setCreditSelectedStudent] = useState(null);
  const [creditDropdownOpen, setCreditDropdownOpen] = useState(false);
  const [creditDescription, setCreditDescription] = useState('');
  const [creditAmount, setCreditAmount] = useState('');
  const [creditAlert, setCreditAlert] = useState(null);
  const [creditLoading, setCreditLoading] = useState(false);

  // Edit Student Form
  const [editName, setEditName] = useState('');
  const [editStudentId, setEditStudentId] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editBatch, setEditBatch] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [editAlert, setEditAlert] = useState(null);
  const [editLoading, setEditLoading] = useState(false);

  // Account Statement List
  const [asTransactions, setAsTransactions] = useState([]);

  // Edit Revenue Form
  const [revDetailTitle, setRevDetailTitle] = useState('');
  const [revDetailAmount, setRevDetailAmount] = useState('');
  const [revDetailDate, setRevDetailDate] = useState('');
  const [revDetailNotes, setRevDetailNotes] = useState('');
  const [revDetailAlert, setRevDetailAlert] = useState(null);
  const [revDetailLoading, setRevDetailLoading] = useState(false);

  // Danger Zone Confirms
  const [resetConfirmInput, setResetConfirmInput] = useState('');
  const [resetDeleteStudentsCb, setResetDeleteStudentsCb] = useState(false);
  const [resetModalAlert, setResetModalAlert] = useState(null);

  const [delallConfirmInput, setDelallConfirmInput] = useState('');
  const [delallModalAlert, setDelallModalAlert] = useState(null);

  // Custom Confirmation Modal
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmTitle, setConfirmTitle] = useState('');
  const [confirmMessage, setConfirmMessage] = useState('');
  const [confirmAction, setConfirmAction] = useState(null);
  const [confirmBtnText, setConfirmBtnText] = useState('Delete');

  const triggerConfirm = (title, message, onConfirm, btnText = 'Delete') => {
    setConfirmTitle(title);
    setConfirmMessage(message);
    setConfirmAction(() => onConfirm);
    setConfirmBtnText(btnText);
    setConfirmOpen(true);
  };

  // Reports filters
  const [reportMonthPicker, setReportMonthPicker] = useState('');
  const [reportFromDate, setReportFromDate] = useState('');
  const [reportToDate, setReportToDate] = useState('');

  // Month Picker Counter Values
  const [mrRev, setMrRev] = useState(0);
  const [mrExp, setMrExp] = useState(0);
  const [mrBwPages, setMrBwPages] = useState(0);
  const [mrColourPages, setMrColourPages] = useState(0);
  const [mrOpeningBalance, setMrOpeningBalance] = useState(0);

  // Formatting helpers
  const fmt = (n) => '₹' + Number(n || 0).toLocaleString('en-IN');
  const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-IN') : '—');

  const showToast = (message, type = 'info') => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  };

  const loadAllData = async (force = true) => {
    setLoading(true);
    try {
      const [{ data: summary }, { data: studentsData }, { data: expensesData }, { data: revenueData }, { data: debitsData }] = await Promise.all([
        getFinancialSummary(),
        getStudents(),
        getExpenses(),
        getRevenue(),
        getDebits()
      ]);

      if (summary) setFinancialSummary(summary);
      if (studentsData) setStudents(studentsData);
      if (expensesData) setExpenses(expensesData);
      if (revenueData) setRevenue(revenueData);
      if (debitsData) setDebits(debitsData);

      // Auto-fill dates
      const todayStr = new Date().toISOString().split('T')[0];
      setRevDate(todayStr);
      setExpDate(todayStr);

      const today = new Date();
      const monthStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
      setReportMonthPicker(monthStr);
    } catch (err) {
      console.error(err);
      showToast('Error loading data: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Auth check & mounting
  useEffect(() => {
    setIsMounted(true);
    const user = getCurrentUser();
    if (!user || user.role !== 'admin') {
      router.replace('/login');
    } else {
      setCurrentUser(user);
      loadAllData();
    }
  }, []);

  // Update Monthly Report values when Month Picker or data changes
  useEffect(() => {
    if (!reportMonthPicker) return;
    const CASH_SOURCES = new Set(['direct cash', 'fee payment']);

    const monthCashRev = revenue.filter((r) => {
      const d = r.date || (r.createdAt ? r.createdAt.split('T')[0] : '');
      const src = (r.source || '').toLowerCase();
      return d.startsWith(reportMonthPicker) && CASH_SOURCES.has(src);
    });
    const totalRev = monthCashRev.reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0);

    const monthExp = expenses.filter((e) => {
      const d = e.date || (e.createdAt ? e.createdAt.split('T')[0] : '');
      return d.startsWith(reportMonthPicker);
    });
    const totalExp = monthExp.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);

    const monthPrintDebits = debits.filter((d) => {
      const dateStr = d.createdAt || d.date || '';
      return dateStr.startsWith(reportMonthPicker) && d.type === 'debit' && d.source_description === 'Print';
    });

    let bw = 0;
    let col = 0;

    monthPrintDebits.forEach((d) => {
      if (typeof d.pages === 'number' && d.print_type) {
        const mult = (d.print_side || '').toLowerCase().includes('two') ||
          (d.description || '').toLowerCase().includes('two side') ? 2 : 1;
        if (d.print_type === 'bw') bw += d.pages * mult;
        if (d.print_type === 'colour') col += d.pages * mult;
      } else {
        const desc = d.description || '';
        const match = desc.match(/(\d+)\s+pages?\s+(B&W|Colour)/i);
        if (match) {
          let pages = parseInt(match[1]) || 0;
          const type = match[2].toLowerCase();
          if (desc.toLowerCase().includes('two side')) pages *= 2;
          if (type.includes('b&w')) bw += pages;
          if (type.includes('colour')) col += pages;
        }
      }
    });

    setMrRev(totalRev);
    setMrExp(totalExp);
    setMrBwPages(bw);
    setMrColourPages(col);

    // Fetch opening balance from database
    const fetchOpening = async () => {
      const startDate = `${reportMonthPicker}-01`;
      const { openingBalance, error } = await getOpeningBalance(startDate);
      if (!error) {
        setMrOpeningBalance(openingBalance);
      }
    };
    fetchOpening();
  }, [reportMonthPicker, revenue, expenses, debits]);

  // Autocalculate print costs
  useEffect(() => {
    if (debitType === 'opening') {
      // Amount is editable
    } else {
      let rate = 3;
      if (debitType === 'bw') {
        rate = debitSide === 'two' ? 4 : 3;
      } else if (debitType === 'colour') {
        rate = debitSide === 'two' ? 20 : 10;
      }
      let finalAmount = (rate * debitPages) - debitDiscount;
      setDebitAmount(Math.max(0, finalAmount));
    }
  }, [debitType, debitSide, debitPages, debitDiscount]);

  // Click outside to close menus/dropdowns
  useEffect(() => {
    const handleGlobalClick = () => {
      setActiveKebabStudentId(null);
      setDebitDropdownOpen(false);
      setCreditDropdownOpen(false);
    };
    window.addEventListener('click', handleGlobalClick);
    return () => window.removeEventListener('click', handleGlobalClick);
  }, []);

  useEffect(() => {
    if (!activeModal) {
      setShowInlineRegister(false);
      setInlineRegName('');
      setInlineRegStudentId('');
      setInlineRegBatch('');
      setInlineRegPhone('');
      setInlineRegPassword('');
      setInlineRegAlert(null);
    }
  }, [activeModal]);

  if (!isMounted || !currentUser) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#0a0f1e', color: '#fff', fontFamily: 'system-ui, sans-serif' }}>
        <div>Loading Admin...</div>
      </div>
    );
  }

  // --- ACTIONS ---

  const handleLogoutClick = () => {
    logoutUser();
    localStorage.removeItem('auto_login_admin');
    router.push('/login');
  };

  const toTitleCase = (str) => {
    if (!str) return '';
    return str.split(' ').map((word) => {
      if (!word) return '';
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    }).join(' ');
  };

  // Register Student
  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    setRegLoading(true);
    setRegAlert(null);

    const titleCasedName = toTitleCase(regName.trim());
    const studentIdClean = regStudentId.trim().toLowerCase();

    const studentData = {
      name: titleCasedName,
      studentId: studentIdClean,
      phone: regPhone.trim(),
      password: regPassword,
      batch: regBatch.trim(),
      email: '',
      course: '',
      department: '',
      semester: '',
      totalFee: 0,
      paidAmount: 0,
      account_balance: 0
    };

    const { data, error } = await createStudent(studentData);
    if (error) {
      setRegAlert({ type: 'error', text: error });
      setRegLoading(false);
      return;
    }

    setRegAlert({ type: 'success', text: `Student "${data.name}" registered! Login: ${studentIdClean}` });
    setRegName('');
    setRegStudentId('');
    setRegBatch('');
    setRegPhone('');
    setRegPassword('');
    setRegLoading(false);
    showToast('Student registered successfully!', 'success');
    await loadAllData();
  };

  // Inline Quick Register Form Submit
  const handleInlineRegisterSubmit = async (e) => {
    e.preventDefault();
    setInlineRegLoading(true);
    setInlineRegAlert(null);

    const titleCasedName = toTitleCase(inlineRegName.trim());
    const studentIdClean = inlineRegStudentId.trim().toLowerCase();

    const studentData = {
      name: titleCasedName,
      studentId: studentIdClean,
      phone: inlineRegPhone.trim(),
      password: inlineRegPassword,
      batch: inlineRegBatch.trim(),
      email: '',
      course: '',
      department: '',
      semester: '',
      totalFee: 0,
      paidAmount: 0,
      account_balance: 0
    };

    const { data, error } = await createStudent(studentData);
    if (error) {
      setInlineRegAlert({ type: 'error', text: error });
      setInlineRegLoading(false);
      return;
    }

    // Auto-select this student
    if (activeModal === 'debit-modal') {
      setDebitSelectedStudents(prev => [...prev, data]);
      setDebitSearchInput('');
    } else if (activeModal === 'credit-modal') {
      setCreditSelectedStudent(data);
      setCreditSearchInput('');
    }

    setInlineRegName('');
    setInlineRegStudentId('');
    setInlineRegBatch('');
    setInlineRegPhone('');
    setInlineRegPassword('');
    setInlineRegLoading(false);
    setShowInlineRegister(false);
    showToast('Student registered successfully!', 'success');
    await loadAllData();
  };

  // Bulk Register
  const downloadCSVTemplate = () => {
    const csv = 'name,studentId,batch,phone,password,openingBalance\nJohn Doe,STU-001,Batch A,9876543210,pass123,150\nJane Smith,STU-002,Batch B,9123456780,pass456,0';
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'student_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCSVUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setBulkText(ev.target.result);
    };
    reader.readAsText(file);
  };

  const handleBulkRegisterSubmit = async (e) => {
    e.preventDefault();
    if (!bulkText.trim()) {
      setBulkAlert({ type: 'error', text: 'No data to import.' });
      return;
    }
    setBulkLoading(true);
    setBulkAlert(null);

    const lines = bulkText.split('\n').filter((l) => l.trim());
    const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());

    if (!headers.includes('name') || !headers.includes('studentid')) {
      setBulkAlert({ type: 'error', text: 'CSV must contain at least "name" and "studentId" headers.' });
      setBulkLoading(false);
      return;
    }

    const rows = lines.slice(1).map((line) => {
      const vals = line.split(',').map((v) => v.trim());
      const rowObj = Object.fromEntries(headers.map((h, idx) => [h, vals[idx] || '']));
      const openingBalance = Math.max(0, parseFloat(rowObj.openingbalance) || 0);

      return {
        name: rowObj.name || '',
        studentId: (rowObj.studentid || '').toLowerCase(),
        phone: rowObj.phone || '',
        password: rowObj.password || (rowObj.studentid ? rowObj.studentid.toLowerCase() + '123' : 'pass123'),
        batch: rowObj.batch || '',
        email: '',
        course: '',
        department: '',
        semester: '',
        totalFee: 0,
        paidAmount: 0,
        account_balance: openingBalance,
        _openingBalance: openingBalance
      };
    }).filter((r) => r.name && r.studentId);

    if (!rows.length) {
      setBulkAlert({ type: 'error', text: 'No valid student entries found to import.' });
      setBulkLoading(false);
      return;
    }

    const results = await bulkCreateStudents(rows);
    let ledgerWritten = 0;
    for (const created of results.created) {
      const inputRow = rows.find((r) => r.studentId === created.studentId);
      const ob = inputRow?._openingBalance || 0;
      if (ob > 0) ledgerWritten++;
    }

    const obNote = ledgerWritten > 0 ? ` (${ledgerWritten} opening balance${ledgerWritten > 1 ? 's' : ''} recorded)` : '';
    setBulkAlert({
      type: 'success',
      text: `Imported ${results.created.length} students${obNote}. ${results.errors.length ? `❌ ${results.errors.length} failed: ${results.errors.map((err) => err.student.studentId + ': ' + err.error).join(', ')}` : ''}`
    });

    if (results.created.length) {
      showToast(`${results.created.length} students imported!`, 'success');
      setBulkText('');
      await loadAllData();
    }
    setBulkLoading(false);
  };

  // Add Revenue Direct
  const handleAddRevenueSubmit = async (e) => {
    e.preventDefault();
    setRevLoading(true);
    setRevAlert(null);

    const title = revTitle.trim();
    if (!title) {
      setRevAlert({ type: 'error', text: 'Title is required.' });
      setRevLoading(false);
      return;
    }

    const amt = parseFloat(revAmount);
    if (!amt || amt <= 0) {
      setRevAlert({ type: 'error', text: 'Amount must be greater than zero.' });
      setRevLoading(false);
      return;
    }

    const dateVal = revDate || new Date().toISOString().split('T')[0];

    if (revType === 'Cash' || revType === 'Opening Cash') {
      const { error } = await addRevenue({
        title,
        amount: amt,
        date: dateVal,
        notes: revNotes.trim(),
        source: revType === 'Opening Cash' ? 'Opening Cash Balance' : 'Direct Cash',
        description: revType === 'Opening Cash' ? 'Opening Cash' : 'Cash',
      });
      if (error) {
        setRevAlert({ type: 'error', text: error });
        setRevLoading(false);
        return;
      }
    } else {
      if (!revStudentId) {
        setRevAlert({ type: 'error', text: 'Please select a student.' });
        setRevLoading(false);
        return;
      }
      const { error } = await applyStudentManualDebit(revStudentId, amt, title, dateVal, revNotes.trim());
      if (error) {
        setRevAlert({ type: 'error', text: error });
        setRevLoading(false);
        return;
      }
    }

    setRevTitle('');
    setRevAmount('');
    setRevNotes('');
    setRevStudentId('');
    setRevType('Cash');
    setRevLoading(false);
    showToast('Revenue recorded successfully!', 'success');
    await loadAllData();
  };

  // Add Expense
  const handleAddExpenseSubmit = async (e) => {
    e.preventDefault();
    setExpLoading(true);
    setExpAlert(null);

    const amt = parseFloat(expAmount);
    if (!amt || amt <= 0) {
      setExpAlert({ type: 'error', text: 'Amount must be greater than zero.' });
      setExpLoading(false);
      return;
    }

    const { error } = await addExpense({
      title: expTitle.trim(),
      amount: amt,
      date: expDate || new Date().toISOString().split('T')[0],
      notes: expNotes.trim(),
      category: 'General'
    });

    if (error) {
      setExpAlert({ type: 'error', text: error });
      setExpLoading(false);
      return;
    }

    setExpTitle('');
    setExpAmount('');
    setExpNotes('');
    setExpLoading(false);
    showToast('Expense added!', 'success');
    await loadAllData();
  };

  const handleDeleteExpenseClick = async (id) => {
    triggerConfirm(
      'Delete Expense',
      'Are you sure you want to delete this expense entry? This cannot be undone.',
      async () => {
        const { error } = await deleteExpense(id);
        if (error) return showToast(error, 'error');
        showToast('Expense deleted.', 'success');
        await loadAllData();
      }
    );
  };

  // Delete Student
  const handleDeleteStudentClick = async (id) => {
    triggerConfirm(
      'Delete Student Account',
      'Are you sure you want to delete this student account? This will also permanently remove all their transaction details and balances.',
      async () => {
        const { error } = await deleteStudent(id);
        if (error) return showToast(error, 'error');
        showToast('Student deleted successfully.', 'success');
        await loadAllData();
      }
    );
  };

  // Edit Student
  const handleOpenEditStudent = (s) => {
    setModalStudent(s);
    setEditName(s.name);
    setEditStudentId(s.studentId);
    setEditPhone(s.phone || '');
    setEditBatch(s.batch || '');
    setEditPassword('');
    setEditAlert(null);
    setActiveModal('edit-student-modal');
  };

  const handleEditStudentSubmit = async (e) => {
    e.preventDefault();
    setEditLoading(true);
    setEditAlert(null);

    const updates = {
      name: editName.trim(),
      studentId: editStudentId.trim(),
      phone: editPhone.trim(),
      batch: editBatch.trim()
    };

    const { error } = await updateStudent(modalStudent.id, updates);
    if (error) {
      setEditAlert({ type: 'error', text: error });
      setEditLoading(false);
      return;
    }

    if (editPassword.trim()) {
      if (modalStudent.userId) {
        await updateUserPassword(modalStudent.userId, editPassword.trim());
      }
    }

    showToast('Student updated successfully.' + (editPassword.trim() ? ' Password changed.' : ''), 'success');
    setActiveModal(null);
    setEditLoading(false);
    await loadAllData();
  };

  // Quick Charge
  const handleOpenQuickCharge = (s) => {
    setModalStudent(s);
    setQcDescription('');
    setQcAmount('');
    setQcAlert(null);
    setActiveModal('quick-charge-modal');
  };

  const handleQuickChargeSubmit = async (e) => {
    e.preventDefault();
    setQcLoading(true);
    setQcAlert(null);

    const amt = parseFloat(qcAmount);
    if (!amt || amt <= 0) {
      setQcAlert({ type: 'error', text: 'Amount must be greater than zero.' });
      setQcLoading(false);
      return;
    }

    const { error } = await applyStudentDebit(modalStudent.id, amt, qcDescription.trim());
    if (error) {
      setQcAlert({ type: 'error', text: error });
      setQcLoading(false);
      return;
    }

    showToast(`Charge of ${fmt(amt)} added successfully!`, 'success');
    setActiveModal(null);
    setQcLoading(false);
    await loadAllData();
  };

  // Quick Collect
  const handleOpenQuickCollect = (s) => {
    setModalStudent(s);
    setQlDescription('');
    setQlAmount('');
    setQlAlert(null);
    setActiveModal('quick-collect-modal');
  };

  const handleQuickCollectSubmit = async (e) => {
    e.preventDefault();
    setQlLoading(true);
    setQlAlert(null);

    const amt = parseFloat(qlAmount);
    if (!amt || amt <= 0) {
      setQlAlert({ type: 'error', text: 'Amount must be greater than zero.' });
      setQlLoading(false);
      return;
    }

    const { error } = await applyStudentCredit(modalStudent.id, amt, qlDescription.trim());
    if (error) {
      setQlAlert({ type: 'error', text: error });
      setQlLoading(false);
      return;
    }

    showToast(`Collection of ${fmt(amt)} logged successfully!`, 'success');
    setActiveModal(null);
    setQlLoading(false);
    await loadAllData();
  };

  // WhatsApp Reminder
  const sendWhatsAppReminder = (name, amount, phone) => {
    if (!phone) {
      showToast('No phone number available for this student.', 'error');
      return;
    }
    const cleanPhone = phone.replace(/[^\d+]/g, '');
    const text = `Hello ${name}, this is a reminder that you have pending lab print dues of ₹${amount}. Please clear them soon.`;
    const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  // Account Statement Detail View
  const handleOpenAccountStatement = (s) => {
    setModalStudent(s);
    const trans = debits.filter((d) => d.studentId === s.id);
    trans.sort((a, b) => {
      const dA = a.createdAt || '';
      const dB = b.createdAt || '';
      return dB.localeCompare(dA);
    });
    setAsTransactions(trans);
    setActiveModal('account-statement-modal');
  };

  // Debit Print Modal
  const handleOpenDebitModal = () => {
    setDebitSearchInput('');
    setDebitSelectedStudents([]);
    setDebitType('bw');
    setDebitSide('one');
    setDebitPages(1);
    setDebitDiscount(0);
    setDebitAmount(3);
    setDebitAlert(null);
    setActiveModal('debit-modal');
  };

  const handleDebitModalSubmit = async (e) => {
    e.preventDefault();
    if (!debitSelectedStudents || debitSelectedStudents.length === 0) {
      setDebitAlert({ type: 'error', text: 'Please search and select at least one student.' });
      return;
    }
    setDebitLoading(true);
    setDebitAlert(null);

    let description, printMeta;
    if (debitType === 'opening') {
      description = 'Previous Arrears / Opening Balance';
      printMeta = {
        print_type: 'opening',
        print_side: null,
        pages: null
      };
    } else {
      const typeLabel = debitType === 'bw' ? 'B&W' : 'Colour';
      const sideLabel = debitSide === 'two' ? 'Two Side' : 'One Side';
      description = `${debitPages} pages ${typeLabel} ${sideLabel}`;
      printMeta = {
        print_type: debitType,
        print_side: debitSide,
        pages: debitPages
      };
    }

    const errors = [];
    for (const student of debitSelectedStudents) {
      const { error } = await applyStudentDebit(student.id, debitAmount, description, printMeta);
      if (error) {
        errors.push(`${student.name}: ${error}`);
      }
    }

    if (errors.length > 0) {
      setDebitAlert({ type: 'error', text: `Failed for: ${errors.join(', ')}` });
      setDebitLoading(false);
      await loadAllData();
      return;
    }

    showToast(`Debit charged successfully to ${debitSelectedStudents.length} student${debitSelectedStudents.length > 1 ? 's' : ''}!`, 'success');
    setActiveModal(null);
    setDebitLoading(false);
    await loadAllData();
  };

  // Credit Print Modal
  const handleOpenCreditModal = () => {
    setCreditSearchInput('');
    setCreditSelectedStudent(null);
    setCreditDescription('');
    setCreditAmount('');
    setCreditAlert(null);
    setActiveModal('credit-modal');
  };

  const handleCreditModalSubmit = async (e) => {
    e.preventDefault();
    if (!creditSelectedStudent) {
      setCreditAlert({ type: 'error', text: 'Please search and select a student.' });
      return;
    }
    setCreditLoading(true);
    setCreditAlert(null);

    const amt = parseFloat(creditAmount);
    if (!amt || amt <= 0) {
      setCreditAlert({ type: 'error', text: 'Amount must be greater than zero.' });
      setCreditLoading(false);
      return;
    }

    const { error } = await applyStudentCredit(creditSelectedStudent.id, amt, creditDescription.trim());
    if (error) {
      setCreditAlert({ type: 'error', text: error });
      setCreditLoading(false);
      return;
    }

    showToast('Credit recorded successfully!', 'success');
    setActiveModal(null);
    setCreditLoading(false);
    await loadAllData();
  };

  // Revenue Edit details
  const handleOpenRevenueDetail = (entry) => {
    setModalRevenueEntry(entry);
    setRevDetailTitle(entry.title || '');
    setRevDetailAmount(entry.amount || '');
    setRevDetailDate(entry.date || '');
    setRevDetailNotes(entry.notes || '');
    setRevDetailAlert(null);
    setActiveModal('revenue-detail-modal');
  };

  const handleEditRevenueSubmit = async (e) => {
    e.preventDefault();
    setRevDetailLoading(true);
    setRevDetailAlert(null);

    const amt = parseFloat(revDetailAmount);
    if (!revDetailTitle.trim()) {
      setRevDetailAlert({ type: 'error', text: 'Title is required.' });
      setRevDetailLoading(false);
      return;
    }
    if (!amt || amt <= 0) {
      setRevDetailAlert({ type: 'error', text: 'Amount must be greater than zero.' });
      setRevDetailLoading(false);
      return;
    }

    const { error } = await updateRevenue(modalRevenueEntry.id, {
      title: revDetailTitle.trim(),
      amount: amt,
      date: revDetailDate,
      notes: revDetailNotes.trim()
    });

    if (error) {
      setRevDetailAlert({ type: 'error', text: error });
      setRevDetailLoading(false);
      return;
    }

    showToast('Revenue entry updated!', 'success');
    setActiveModal(null);
    setRevDetailLoading(false);
    await loadAllData();
  };

  const handleDeleteRevenueEntry = async () => {
    triggerConfirm(
      'Delete Revenue Entry',
      'Are you sure you want to delete this revenue entry? This cannot be undone and will reverse any linked student charges/payments.',
      async () => {
        const linkedDebit = debits.find((d) => d.revenue_id === modalRevenueEntry.id);
        if (linkedDebit) {
          const { error } = await reverseAndDeleteEntry(linkedDebit.id);
          if (error) return showToast(error, 'error');
        } else {
          const { error } = await deleteRevenue(modalRevenueEntry.id);
          if (error) return showToast(error, 'error');
        }
        showToast('Revenue entry deleted.', 'success');
        setActiveModal(null);
        await loadAllData();
      }
    );
  };

  // Daily statement
  const handleOpenDailyStatement = (date) => {
    setDailyStatementDate(date);
    const filtered = revenue.filter((r) => {
      const d = r.date || (r.createdAt ? r.createdAt.split('T')[0] : '');
      return d === date;
    });
    setDailyStatementEntries(filtered);
    setActiveModal('dailyStatementModal');
  };

  const handleDeleteDailyRevenueEntry = async (revenueId) => {
    triggerConfirm(
      'Delete Revenue Entry',
      'Are you sure you want to delete this revenue entry? This will reverse any linked student charges/payments.',
      async () => {
        const linkedDebit = debits.find((d) => d.revenue_id === revenueId);
        if (linkedDebit) {
          const { error } = await reverseAndDeleteEntry(linkedDebit.id);
          if (error) return showToast(`Error reversing entry: ${error}`, 'error');
        } else {
          const { error } = await deleteRevenue(revenueId);
          if (error) return showToast(`Error deleting entry: ${error}`, 'error');
        }
        showToast('Revenue entry deleted successfully!', 'success');
        // Refresh local lists
        const updatedRev = revenue.filter((r) => r.id !== revenueId);
        setRevenue(updatedRev);
        const updatedEntries = dailyStatementEntries.filter((r) => r.id !== revenueId);
        setDailyStatementEntries(updatedEntries);
        if (updatedEntries.length === 0) {
          setActiveModal(null);
        }
        await loadAllData();
      }
    );
  };

  // --- REPORT EXPORTS (HTML PRINTS) ---

  const handlePrintMonthlyReport = async () => {
    if (!reportMonthPicker) {
      showToast('Please select a month first.', 'error');
      return;
    }
    // Fetch opening balance from database
    const startDate = `${reportMonthPicker}-01`;
    const { openingBalance, error } = await getOpeningBalance(startDate);
    if (error) {
      showToast('Error calculating opening balance: ' + error, 'error');
    }
    const opBal = openingBalance || 0;
    const CASH_SOURCES = new Set(['direct cash', 'fee payment']);

    const getWeek = (dateStr) => {
      const day = parseInt((dateStr || '').split('-')[2] || '1');
      if (day <= 7) return 'Week 1';
      if (day <= 14) return 'Week 2';
      if (day <= 21) return 'Week 3';
      return 'Week 4';
    };

    const revLabel = (r) =>
      (r.source || '').toLowerCase() === 'fee payment' ? 'Print Revenue' : (r.title || 'Revenue');

    const monthRevAll = revenue.filter((r) => {
      const d = r.date || (r.createdAt ? r.createdAt.split('T')[0] : '');
      return d.startsWith(reportMonthPicker);
    });
    const monthCashRev = monthRevAll.filter((r) => CASH_SOURCES.has((r.source || '').toLowerCase()));
    const totalRev = monthCashRev.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);

    const monthExp = expenses.filter((e) => {
      const d = e.date || (e.createdAt ? e.createdAt.split('T')[0] : '');
      return d.startsWith(reportMonthPicker);
    });
    const totalExp = monthExp.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
    const netBalance = totalRev - totalExp;
    const closingBalance = opBal + totalRev - totalExp;

    const monthPendingDebits = debits.filter((d) => {
      const dStr = d.createdAt || d.date || '';
      return dStr.startsWith(reportMonthPicker) && d.type === 'debit' && d.status === 'pending';
    });
    const totalPending = monthPendingDebits.reduce((s, d) => s + (parseFloat(d.amount) || 0), 0);

    let bwPages = 0, colourPages = 0;
    const monthPrintDebits = debits.filter((d) => {
      const ds = d.createdAt || d.date || '';
      return ds.startsWith(reportMonthPicker) && d.type === 'debit' && d.source_description === 'Print';
    });
    monthPrintDebits.forEach((d) => {
      if (typeof d.pages === 'number' && d.print_type) {
        const mult = (d.print_side || '').toLowerCase().includes('two') ||
          (d.description || '').toLowerCase().includes('two side') ? 2 : 1;
        if (d.print_type === 'bw') bwPages += d.pages * mult;
        if (d.print_type === 'colour') colourPages += d.pages * mult;
      } else {
        const m = (d.description || '').match(/(\d+)\s+pages?\s+(B&W|Colour)/i);
        if (m) {
          let p = parseInt(m[1]) || 0;
          if ((d.description || '').toLowerCase().includes('two side')) p *= 2;
          if (m[2].toLowerCase().includes('b&w')) bwPages += p;
          if (m[2].toLowerCase().includes('colour')) colourPages += p;
        }
      }
    });

    const revByWeek = {};
    monthCashRev.forEach((r) => {
      const d = r.date || (r.createdAt ? r.createdAt.split('T')[0] : '');
      const week = getWeek(d);
      const lbl = revLabel(r);
      if (!revByWeek[week]) revByWeek[week] = {};
      revByWeek[week][lbl] = (revByWeek[week][lbl] || 0) + (parseFloat(r.amount) || 0);
    });

    const expByWeek = {};
    monthExp.forEach((e) => {
      const d = e.date || (e.createdAt ? e.createdAt.split('T')[0] : '');
      const week = getWeek(d);
      const lbl = e.title || 'Expense';
      if (!expByWeek[week]) expByWeek[week] = {};
      expByWeek[week][lbl] = (expByWeek[week][lbl] || 0) + (parseFloat(e.amount) || 0);
    });

    const WEEKS = ['Week 1', 'Week 2', 'Week 3', 'Week 4'];
    let revRowsHtml = '';
    WEEKS.forEach((week) => {
      if (!revByWeek[week]) return;
      Object.entries(revByWeek[week]).forEach(([lbl, amt], i) => {
        revRowsHtml += `<tr>
          <td style="font-weight:600;color:#475569">${i === 0 ? week : ''}</td>
          <td><strong>${lbl}</strong></td>
          <td class="text-right text-success">${fmt(amt)}</td>
        </tr>`;
      });
    });
    if (!revRowsHtml) revRowsHtml = '<tr><td colspan="3" style="text-align:center;color:#64748b">No cash revenue this month.</td></tr>';

    let expRowsHtml = '';
    WEEKS.forEach((week) => {
      if (!expByWeek[week]) return;
      Object.entries(expByWeek[week]).forEach(([lbl, amt], i) => {
        expRowsHtml += `<tr>
          <td style="font-weight:600;color:#475569">${i === 0 ? week : ''}</td>
          <td><strong>${lbl}</strong></td>
          <td class="text-right text-danger">${fmt(amt)}</td>
        </tr>`;
      });
    });
    if (!expRowsHtml) expRowsHtml = '<tr><td colspan="3" style="text-align:center;color:#64748b">No expenses this month.</td></tr>';

    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html><head>
        <title>Monthly Report - ${reportMonthPicker}</title>
        <style>
          body { font-family: system-ui, sans-serif; padding: 2rem; color: #1e293b; background: #fff; line-height: 1.5; }
          .header { text-align: center; margin-bottom: 2rem; border-bottom: 2px solid #e2e8f0; padding-bottom: 1rem; }
          .header h1 { margin: 0 0 .25rem; color: #0f172a; font-size: 22px; }
          .header p  { margin: 0; color: #64748b; font-size: 13px; }
          .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; margin-bottom: 2.5rem; }
          .card { border: 1px solid #e2e8f0; border-radius: 8px; padding: 1rem; text-align: center; background: #f8fafc; }
          .card .label { font-size: 10px; text-transform: uppercase; color: #64748b; margin-bottom: .25rem; font-weight: 600; }
          .card .value { font-size: 16px; font-weight: 700; color: #0f172a; }
          .section-title { font-size: 14px; font-weight: 700; color: #1e293b; margin: 2rem 0 .6rem; border-left: 4px solid #6c63ff; padding-left: .5rem; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 2rem; font-size: 13px; }
          th, td { border: 1px solid #e2e8f0; padding: 8px 12px; text-align: left; }
          th { background: #f1f5f9; font-weight: 600; color: #475569; }
          .text-right { text-align: right; }
          .text-success { color: #16a34a; font-weight: 600; }
          .text-danger  { color: #dc2626; font-weight: 600; }
          @media print { body { padding: 0; } }
        </style>
      </head><body>
        <div class="header">
          <h1>Lab Accounts — Monthly Report</h1>
          <p>Report Month: ${reportMonthPicker}</p>
        </div>
        <div class="grid">
          <div class="card"><div class="label">Opening Balance</div><div class="value" style="color:#2563eb">${fmt(opBal)}</div></div>
          <div class="card"><div class="label">Total Revenue</div><div class="value text-success">${fmt(totalRev)}</div></div>
          <div class="card"><div class="label">Total Expenses</div><div class="value text-danger">${fmt(totalExp)}</div></div>
          <div class="card"><div class="label">Closing Balance</div><div class="value" style="color:#0369a1">${fmt(closingBalance)}</div></div>
          <div class="card"><div class="label">Net Balance</div><div class="value ${netBalance >= 0 ? 'text-success' : 'text-danger'}">${fmt(netBalance)}</div></div>
          <div class="card"><div class="label">Pending Debits</div><div class="value" style="color:#f59e0b">${fmt(totalPending)}</div></div>
          <div class="card"><div class="label">B&amp;W Pages</div><div class="value">${bwPages}</div></div>
          <div class="card"><div class="label">Colour Pages</div><div class="value">${colourPages}</div></div>
        </div>

        <div class="section-title">Report Summary</div>
        <table>
          <thead>
            <tr>
              <th>Metric</th>
              <th class="text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>Opening Balance</strong></td>
              <td class="text-right" style="color:#2563eb; font-weight:700">${fmt(opBal)}</td>
            </tr>
            <tr>
              <td>Total Revenue (Selected Month)</td>
              <td class="text-right text-success">+ ${fmt(totalRev)}</td>
            </tr>
            <tr>
              <td>Total Expenses (Selected Month)</td>
              <td class="text-right text-danger">- ${fmt(totalExp)}</td>
            </tr>
            <tr style="background:#f1f5f9; font-weight:700;">
              <td><strong>Closing Balance</strong></td>
              <td class="text-right" style="color:#0f172a;">${fmt(closingBalance)}</td>
            </tr>
          </tbody>
        </table>

        <div class="section-title">Revenue (Weekly Summary)</div>
        <table>
          <thead><tr><th>Week</th><th>Category</th><th class="text-right">Amount</th></tr></thead>
          <tbody>${revRowsHtml}</tbody>
        </table>
        <div class="section-title">Expenses (Weekly Summary)</div>
        <table>
          <thead><tr><th>Week</th><th>Category</th><th class="text-right">Amount</th></tr></thead>
          <tbody>${expRowsHtml}</tbody>
        </table>
        <script>window.onload=function(){setTimeout(function(){window.print();},300);};<\/script>
      </body></html>
    `);
    printWindow.document.close();
    showToast('Monthly report opened!', 'success');
  };

  const handlePrintCustomReport = async () => {
    if (!reportFromDate || !reportToDate) {
      showToast('Please select both From Date and To Date.', 'error');
      return;
    }
    // Fetch opening balance from database
    const { openingBalance, error } = await getOpeningBalance(reportFromDate);
    if (error) {
      showToast('Error calculating opening balance: ' + error, 'error');
    }
    const opBal = openingBalance || 0;
    const CASH_SOURCES = new Set(['direct cash', 'fee payment']);
    const startDate = new Date(reportFromDate);
    const endDate = new Date(reportToDate + 'T23:59:59');

    const parseTxDate = (tx) => {
      const ds = tx.date || tx.createdAt || '';
      return ds ? new Date(ds) : null;
    };

    const yearRevAll = revenue.filter((r) => {
      const txDate = parseTxDate(r);
      return txDate && txDate >= startDate && txDate <= endDate;
    });
    const yearCashRev = yearRevAll.filter((r) => CASH_SOURCES.has((r.source || '').toLowerCase()));
    const totalRev = yearCashRev.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);

    const yearExp = expenses.filter((e) => {
      const txDate = parseTxDate(e);
      return txDate && txDate >= startDate && txDate <= endDate;
    });
    const totalExp = yearExp.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
    const netBalance = totalRev - totalExp;
    const closingBalance = opBal + totalRev - totalExp;

    const periodPendingDebits = debits.filter((d) => {
      const txDate = parseTxDate(d);
      return txDate && txDate >= startDate && txDate <= endDate && d.type === 'debit' && d.status === 'pending';
    });
    const totalPending = periodPendingDebits.reduce((s, d) => s + (parseFloat(d.amount) || 0), 0);

    let bwPages = 0, colourPages = 0;
    const yearPrintDebits = debits.filter((d) => {
      const txDate = parseTxDate(d);
      return txDate && txDate >= startDate && txDate <= endDate && d.type === 'debit' && d.source_description === 'Print';
    });
    yearPrintDebits.forEach((d) => {
      if (typeof d.pages === 'number' && d.print_type) {
        const mult = (d.print_side || '').toLowerCase().includes('two') ||
          (d.description || '').toLowerCase().includes('two side') ? 2 : 1;
        if (d.print_type === 'bw') bwPages += d.pages * mult;
        if (d.print_type === 'colour') colourPages += d.pages * mult;
      } else {
        const m = (d.description || '').match(/(\d+)\s+pages?\s+(B&W|Colour)/i);
        if (m) {
          let p = parseInt(m[1]) || 0;
          if ((d.description || '').toLowerCase().includes('two side')) p *= 2;
          if (m[2].toLowerCase().includes('b&w')) bwPages += p;
          if (m[2].toLowerCase().includes('colour')) colourPages += p;
        }
      }
    });

    const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const revByMonthKey = {};

    yearCashRev.forEach((r) => {
      const txDate = parseTxDate(r);
      if (!txDate) return;
      const m = txDate.getMonth();
      const y = txDate.getFullYear();
      const sortKey = `${y}-${String(m + 1).padStart(2, '0')}`;

      if (!revByMonthKey[sortKey]) {
        revByMonthKey[sortKey] = {
          label: `${MONTHS[m]} ${y}`,
          revenue: 0,
          expense: 0
        };
      }
      revByMonthKey[sortKey].revenue += (parseFloat(r.amount) || 0);
    });

    yearExp.forEach((e) => {
      const txDate = parseTxDate(e);
      if (!txDate) return;
      const m = txDate.getMonth();
      const y = txDate.getFullYear();
      const sortKey = `${y}-${String(m + 1).padStart(2, '0')}`;

      if (!revByMonthKey[sortKey]) {
        revByMonthKey[sortKey] = {
          label: `${MONTHS[m]} ${y}`,
          revenue: 0,
          expense: 0
        };
      }
      revByMonthKey[sortKey].expense += (parseFloat(e.amount) || 0);
    });

    const sortedKeys = Object.keys(revByMonthKey).sort();
    let monthRowsHtml = `<tr>
      <td style="font-weight:600; color:#2563eb;">Opening Balance (Before ${fmtDate(reportFromDate)})</td>
      <td class="text-right">—</td>
      <td class="text-right">—</td>
      <td class="text-right">—</td>
      <td class="text-right" style="color:#2563eb; font-weight:700;">${fmt(opBal)}</td>
    </tr>`;
    let runningBalance = opBal;
    let hasAnyData = false;

    sortedKeys.forEach((key) => {
      const entry = revByMonthKey[key];
      const r = entry.revenue;
      const e = entry.expense;
      if (r > 0 || e > 0) hasAnyData = true;

      const net = r - e;
      runningBalance += net;

      monthRowsHtml += `<tr>
        <td style="font-weight:600">${entry.label}</td>
        <td class="text-right text-success">${r > 0 ? fmt(r) : '—'}</td>
        <td class="text-right text-danger">${e > 0 ? fmt(e) : '—'}</td>
        <td class="text-right ${net >= 0 ? 'text-success' : 'text-danger'}">${fmt(net)}</td>
        <td class="text-right" style="color:#475569">${fmt(runningBalance)}</td>
      </tr>`;
    });

    if (!hasAnyData && opBal === 0) {
      monthRowsHtml = '<tr><td colspan="5" style="text-align:center;color:#64748b">No transactions recorded in this range.</td></tr>';
    }

    const netStatusLabel = netBalance >= 0 ? 'Surplus' : 'Deficit';
    const netStatusColorClass = netBalance >= 0 ? 'text-success' : 'text-danger';

    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html><head>
        <title>Custom Date Range Report</title>
        <style>
          body { font-family: system-ui, sans-serif; padding: 2rem; color: #1e293b; background: #fff; line-height: 1.5; }
          .header { text-align: center; margin-bottom: 2rem; border-bottom: 2px solid #e2e8f0; padding-bottom: 1rem; }
          .header h1 { margin: 0 0 .25rem; color: #0f172a; font-size: 22px; }
          .header p  { margin: 0; color: #64748b; font-size: 13px; }
          .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; margin-bottom: 2.5rem; }
          .card { border: 1px solid #e2e8f0; border-radius: 8px; padding: 1rem; text-align: center; background: #f8fafc; }
          .card .label { font-size: 10px; text-transform: uppercase; color: #64748b; margin-bottom: .25rem; font-weight: 600; }
          .card .value { font-size: 16px; font-weight: 700; color: #0f172a; }
          .section-title { font-size: 14px; font-weight: 700; color: #1e293b; margin: 2rem 0 .6rem; border-left: 4px solid #6c63ff; padding-left: .5rem; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 2rem; font-size: 13px; }
          th, td { border: 1px solid #e2e8f0; padding: 8px 12px; text-align: left; }
          th { background: #f1f5f9; font-weight: 600; color: #475569; }
          .text-right { text-align: right; }
          .text-success { color: #16a34a; font-weight: 600; }
          .text-danger  { color: #dc2626; font-weight: 600; }
          tfoot td { background: #f1f5f9; font-weight: 700; }
          @media print { body { padding: 0; } }
        </style>
      </head><body>
        <div class="header">
          <h1>Lab Accounts</h1>
          <p>Report Period: ${reportFromDate} to ${reportToDate}</p>
        </div>
        <div class="grid">
          <div class="card"><div class="label">Opening Balance</div><div class="value" style="color:#2563eb">${fmt(opBal)}</div></div>
          <div class="card"><div class="label">Total Collections</div><div class="value text-success">${fmt(totalRev)}</div></div>
          <div class="card"><div class="label">Total Expenses</div><div class="value text-danger">${fmt(totalExp)}</div></div>
          <div class="card"><div class="label">Closing Balance</div><div class="value" style="color:#0369a1">${fmt(closingBalance)}</div></div>
          <div class="card"><div class="label">Net Status</div><div class="value ${netStatusColorClass}">${netStatusLabel}: ${fmt(Math.abs(netBalance))}</div></div>
          <div class="card"><div class="label">Pending Debits</div><div class="value" style="color:#f59e0b">${fmt(totalPending)}</div></div>
          <div class="card"><div class="label">B&amp;W Pages</div><div class="value">${bwPages}</div></div>
          <div class="card"><div class="label">Colour Pages</div><div class="value">${colourPages}</div></div>
        </div>
        <div class="section-title">Month-by-Month Summary — Period ${reportFromDate} to ${reportToDate}</div>
        <table>
          <thead><tr>
            <th>Month</th>
            <th class="text-right">Revenue</th>
            <th class="text-right">Expenses</th>
            <th class="text-right">Net (Month)</th>
            <th class="text-right">Running Balance</th>
          </tr></thead>
          <tbody>${monthRowsHtml}</tbody>
          <tfoot>
            <tr>
              <td><strong>Total Period Activity</strong></td>
              <td class="text-right text-success">${fmt(totalRev)}</td>
              <td class="text-right text-danger">${fmt(totalExp)}</td>
              <td class="text-right ${netBalance >= 0 ? 'text-success' : 'text-danger'}">${fmt(netBalance)}</td>
              <td class="text-right"></td>
            </tr>
            <tr style="background:#e0f2fe; font-weight:bold;">
              <td style="color:#0369a1;"><strong>Closing Balance</strong></td>
              <td colspan="3" class="text-right"></td>
              <td class="text-right" style="color:#0369a1;">${fmt(closingBalance)}</td>
            </tr>
          </tfoot>
        </table>
        <script>window.onload=function(){setTimeout(function(){window.print();},300);};<\/script>
      </body></html>
    `);
    printWindow.document.close();
    showToast('Custom range report opened!', 'success');
  };

  const handlePrintDebtorReport = () => {
    const relevant = students.filter((s) =>
      (s.account_balance ?? 0) !== 0 || debits.some((d) => d.studentId === s.id)
    );

    let totalDue = 0;
    let totalAdvance = 0;
    relevant.forEach((s) => {
      const bal = s.account_balance ?? 0;
      if (bal > 0) totalDue += bal;
      else if (bal < 0) totalAdvance += Math.abs(bal);
    });
    const netOutstanding = totalDue - totalAdvance;

    const half = Math.ceil(relevant.length / 2);
    const leftCol = relevant.slice(0, half);
    const rightCol = relevant.slice(half);

    const makeRows = (list) => {
      let rowsHtml = '';
      list.forEach((s) => {
        const bal = s.account_balance ?? 0;
        let amtText = '₹0.00';
        let statusColor = '#64748b';
        if (bal > 0) {
          amtText = fmt(bal) + ' (Due)';
          statusColor = '#dc2626';
        } else if (bal < 0) {
          amtText = fmt(Math.abs(bal)) + ' (Adv)';
          statusColor = '#16a34a';
        } else {
          amtText = 'Cleared';
          statusColor = '#64748b';
        }

        rowsHtml += `<tr>
          <td><strong>${s.name}</strong> <span style="font-size:10px; color:#64748b; font-weight:normal;">(${s.batch || '—'})</span></td>
          <td class="text-right" style="color:${statusColor}; font-weight:700">${amtText}</td>
        </tr>`;
      });
      if (!rowsHtml) {
        rowsHtml = '<tr><td colspan="2" style="text-align:center;color:#64748b">—</td></tr>';
      }
      return rowsHtml;
    };

    const leftRowsHtml = makeRows(leftCol);
    const rightRowsHtml = makeRows(rightCol);

    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html><head>
        <title>Debtor Management Report</title>
        <style>
          body { font-family: system-ui, sans-serif; padding: 2rem; color: #1e293b; background: #fff; line-height: 1.5; }
          .header { text-align: center; margin-bottom: 2rem; border-bottom: 2px solid #e2e8f0; padding-bottom: 1rem; }
          .header h1 { margin: 0 0 .25rem; color: #0f172a; font-size: 22px; }
          .header p  { margin: 0; color: #64748b; font-size: 13px; }
          .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; margin-bottom: 2.5rem; }
          .card { border: 1px solid #e2e8f0; border-radius: 8px; padding: 1rem; text-align: center; background: #f8fafc; }
          .card .label { font-size: 10px; text-transform: uppercase; color: #64748b; margin-bottom: .25rem; font-weight: 600; }
          .card .value { font-size: 16px; font-weight: 700; color: #0f172a; }
          .section-title { font-size: 14px; font-weight: 700; color: #1e293b; margin: 2rem 0 .6rem; border-left: 4px solid #f97316; padding-left: .5rem; }
          .columns-container { display: flex; gap: 2rem; }
          .column { flex: 1; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 2rem; font-size: 13px; }
          th, td { border: 1px solid #e2e8f0; padding: 8px 12px; text-align: left; }
          th { background: #f1f5f9; font-weight: 600; color: #475569; }
          .text-right { text-align: right; }
          @media print { body { padding: 0; } }
        </style>
      </head><body>
        <div class="header">
          <h1>Lab Accounts — Debtor Management Report</h1>
          <p>Generated on: ${new Date().toLocaleString()}</p>
        </div>
        <div class="grid">
          <div class="card"><div class="label">Total Due (Outstanding)</div><div class="value" style="color:#dc2626">${fmt(totalDue)}</div></div>
          <div class="card"><div class="label">Total Advance (Credit)</div><div class="value" style="color:#16a34a">${fmt(totalAdvance)}</div></div>
          <div class="card"><div class="label">Net Outstanding</div><div class="value" style="color:${netOutstanding >= 0 ? '#dc2626' : '#16a34a'}">${fmt(netOutstanding)}</div></div>
          <div class="card"><div class="label">Active Accounts</div><div class="value">${relevant.length}</div></div>
        </div>
        <div class="section-title">Debtor Directory & Account Balances</div>
        <div class="columns-container">
          <div class="column">
            <table>
              <thead><tr>
                <th>Student Name</th>
                <th class="text-right">Balance</th>
              </tr></thead>
              <tbody>${leftRowsHtml}</tbody>
            </table>
          </div>
          <div class="column">
            <table>
              <thead><tr>
                <th>Student Name</th>
                <th class="text-right">Balance</th>
              </tr></thead>
              <tbody>${rightRowsHtml}</tbody>
            </table>
          </div>
        </div>
        <script>window.onload=function(){setTimeout(function(){window.print();},300);};<\/script>
      </body></html>
    `);
    printWindow.document.close();
    showToast('Debtor report opened!', 'success');
  };

  const handleDownloadDebtorCSV = () => {
    const relevant = students.filter((s) =>
      (s.account_balance ?? 0) !== 0 || debits.some((d) => d.studentId === s.id)
    );

    let csvContent = "\uFEFF"; // UTF-8 BOM
    csvContent += "Student Name,Student ID,Batch,Course,Department,Balance Status,Balance Amount\r\n";

    relevant.forEach((s) => {
      const balance = s.account_balance ?? 0;
      let status = "Cleared";
      if (balance > 0) status = "Due";
      else if (balance < 0) status = "Advance";

      const row = [
        s.name,
        s.studentId,
        s.batch || '',
        s.course || '',
        s.department || '',
        status,
        Math.abs(balance)
      ].map((val) => `"${String(val).replace(/"/g, '""')}"`).join(",");
      csvContent += row + "\r\n";
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `debtor_report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Debtor CSV download started!', 'success');
  };

  // --- DANGER ZONE WIPE & BACKUP ---

  const submitResetModalConfirm = async () => {
    if (resetConfirmInput !== 'DELETE') {
      setResetModalAlert("⚠️ Please type 'DELETE' exactly to confirm.");
      return;
    }

    setResetModalAlert(null);
    setActiveModal(null);

    // Save print report values
    const totalExpenses = financialSummary.totalExpenses;
    const cashInHand = financialSummary.cashInHand;
    const pendingDebits = financialSummary.pendingDebits;
    const totalRevenue = revenue.reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0);

    const pendingList = debits.filter((d) => d.status === 'pending');
    let pendingRowsHtml = '';
    pendingList.forEach((d) => {
      pendingRowsHtml += `<tr>
        <td><strong>${d.studentName || '—'}</strong></td>
        <td>${d.description || 'Debit charge'}</td>
        <td>${fmtDate(d.createdAt)}</td>
        <td class="text-right" style="color:#dc2626; font-weight:700">${fmt(d.amount)}</td>
      </tr>`;
    });
    if (!pendingRowsHtml) {
      pendingRowsHtml = '<tr><td colspan="4" style="text-align:center;color:#64748b">— No Pending Debits —</td></tr>';
    }

    const reportHtml = `
      <div style="font-family: system-ui, sans-serif; padding: 2rem; color: #1e293b; background: #fff; line-height: 1.5; min-height: 100vh;">
        <div style="text-align: center; margin-bottom: 2rem; border-bottom: 2px solid #ef4444; padding-bottom: 1rem;">
          <h1 style="margin: 0 0 .25rem; color: #0f172a; font-size: 22px;">Lab Accounts — Master Financial Backup & Reset Report</h1>
          <p style="margin: 0; color: #64748b; font-size: 13px;">Generated on: ${new Date().toLocaleString()} (PRE-RESET AUDIT)</p>
        </div>
        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; margin-bottom: 2.5rem;">
          <div style="border: 1px solid #e2e8f0; border-radius: 8px; padding: 1rem; text-align: center; background: #faf5f5; border-top: 3px solid #ef4444;">
            <div style="font-size: 10px; text-transform: uppercase; color: #64748b; margin-bottom: .25rem; font-weight: 600;">Total Revenue</div>
            <div style="font-size: 16px; font-weight: 700; color: #16a34a;">${fmt(totalRevenue)}</div>
          </div>
          <div style="border: 1px solid #e2e8f0; border-radius: 8px; padding: 1rem; text-align: center; background: #faf5f5; border-top: 3px solid #ef4444;">
            <div style="font-size: 10px; text-transform: uppercase; color: #64748b; margin-bottom: .25rem; font-weight: 600;">Total Expenses</div>
            <div style="font-size: 16px; font-weight: 700; color: #dc2626;">${fmt(totalExpenses)}</div>
          </div>
          <div style="border: 1px solid #e2e8f0; border-radius: 8px; padding: 1rem; text-align: center; background: #faf5f5; border-top: 3px solid #ef4444;">
            <div style="font-size: 10px; text-transform: uppercase; color: #64748b; margin-bottom: .25rem; font-weight: 600;">Cash in Hand</div>
            <div style="font-size: 16px; font-weight: 700; color: #2563eb;">${fmt(cashInHand)}</div>
          </div>
          <div style="border: 1px solid #e2e8f0; border-radius: 8px; padding: 1rem; text-align: center; background: #faf5f5; border-top: 3px solid #ef4444;">
            <div style="font-size: 10px; text-transform: uppercase; color: #64748b; margin-bottom: .25rem; font-weight: 600;">Outstanding Debts</div>
            <div style="font-size: 16px; font-weight: 700; color: #b91c1c;">${fmt(pendingDebits)}</div>
          </div>
        </div>
        <div style="font-size: 14px; font-weight: 700; color: #1e293b; margin: 2rem 0 .6rem; border-left: 4px solid #ef4444; padding-left: .5rem;">Pending Debits (Outstanding Ledger)</div>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 2rem; font-size: 13px;">
          <thead>
            <tr style="background: #f8fafc;">
              <th style="border: 1px solid #e2e8f0; padding: 8px 12px; text-align: left; font-weight: 600; color: #475569;">Student Name</th>
              <th style="border: 1px solid #e2e8f0; padding: 8px 12px; text-align: left; font-weight: 600; color: #475569;">Description</th>
              <th style="border: 1px solid #e2e8f0; padding: 8px 12px; text-align: left; font-weight: 600; color: #475569;">Date</th>
              <th style="border: 1px solid #e2e8f0; padding: 8px 12px; text-align: right; font-weight: 600; color: #475569;">Amount</th>
            </tr>
          </thead>
          <tbody>${pendingRowsHtml}</tbody>
        </table>
      </div>
    `;

    document.body.innerHTML = reportHtml;

    window.onafterprint = async function () {
      document.body.innerHTML = `
        <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100vh; background:#0a0f1e; color:#fff; font-family:system-ui, sans-serif; text-align:center;">
          <div style="font-size: 3rem; margin-bottom: 1rem; animation: pulse 1.5s infinite;">⏳</div>
          <h2 style="margin: 0; font-size: 1.5rem; font-weight: 700;">Deleting data...</h2>
          <p style="color: #64748b; font-size: 0.9rem; margin-top: 0.5rem;">Wiping financial database. Please do not close this tab.</p>
        </div>
      `;

      try {
        const { supabase } = await import('../js/storage.service.js');
        const dummyUuid = '00000000-0000-0000-0000-000000000000';

        const { error: revErr } = await supabase.from('revenue').delete().neq('id', dummyUuid);
        if (revErr) throw revErr;

        const { error: expErr } = await supabase.from('expenses').delete().neq('id', dummyUuid);
        if (expErr) throw expErr;

        const { error: debErr } = await supabase.from('debits').delete().neq('id', dummyUuid);
        if (debErr) throw debErr;

        if (resetDeleteStudentsCb) {
          const { error: studDelErr } = await supabase.from('students').delete().neq('id', dummyUuid);
          if (studDelErr) throw studDelErr;

          const { error: userDelErr } = await supabase.from('users').delete().eq('role', 'student');
          if (userDelErr) throw userDelErr;
        } else {
          const { error: studErr } = await supabase.from('students').update({ account_balance: 0 }).neq('id', dummyUuid);
          if (studErr) throw studErr;
        }

        localStorage.clear();
        alert('Backup printed and all data reset successfully!');
        window.location.reload();
      } catch (dbErr) {
        alert(`Reset failed: ${dbErr.message}`);
        window.location.reload();
      }
    };

    setTimeout(() => {
      window.print();
    }, 300);
  };

  const submitDeleteAllStudentsConfirm = async () => {
    if (delallConfirmInput !== 'DELETE ALL') {
      setDelallModalAlert("⚠️ Please type 'DELETE ALL' exactly to confirm.");
      return;
    }

    setDelallModalAlert(null);
    setActiveModal(null);

    document.body.innerHTML = `
      <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100vh; background:#0a0f1e; color:#fff; font-family:system-ui, sans-serif; text-align:center;">
        <div style="font-size: 3rem; margin-bottom: 1rem; animation: pulse 1.5s infinite;">⏳</div>
        <h2 style="margin: 0; font-size: 1.5rem; font-weight: 700;">Deleting all student accounts...</h2>
        <p style="color: #64748b; font-size: 0.9rem; margin-top: 0.5rem;">Wiping students database. Please do not close this tab.</p>
      </div>
    `;

    try {
      const { supabase } = await import('../js/storage.service.js');
      const dummyUuid = '00000000-0000-0000-0000-000000000000';

      const { error: debErr } = await supabase.from('debits').delete().neq('id', dummyUuid);
      if (debErr) throw debErr;

      const { error: studDelErr } = await supabase.from('students').delete().neq('id', dummyUuid);
      if (studDelErr) throw studDelErr;

      const { error: userDelErr } = await supabase.from('users').delete().eq('role', 'student');
      if (userDelErr) throw userDelErr;

      localStorage.clear();
      alert('All student accounts deleted successfully!');
      window.location.reload();
    } catch (err) {
      alert(`Failed to delete student accounts: ${err.message}`);
      window.location.reload();
    }
  };

  // Reverse debit/credit transaction from statement list
  const handleReverseDebitFromStatement = async (debitId) => {
    triggerConfirm(
      'Reverse & Delete Transaction',
      'Are you sure you want to reverse and delete this transaction? This will automatically adjust the student\'s balance.',
      async () => {
        const { error, reversed } = await reverseAndDeleteEntry(debitId);
        if (error) {
          showToast(error, 'error');
          return;
        }
        showToast(`Transaction reversed successfully for ${reversed.student}`, 'success');
        setActiveModal(null);
        await loadAllData();
      }
    );
  };

  // --- RENDERING FILTER LOGICS ---

  // Students filtering
  const filteredStudents = students.filter((s) => {
    const q = studentSearch.toLowerCase();
    const matchesSearch = s.name.toLowerCase().includes(q) ||
      s.studentId.toLowerCase().includes(q) ||
      (s.course || '').toLowerCase().includes(q) ||
      (s.department || '').toLowerCase().includes(q);

    const matchesBatch = studentBatchFilter === 'all' || (s.batch || '').toLowerCase() === studentBatchFilter.toLowerCase();
    return matchesSearch && matchesBatch;
  });

  // Debtors filtering
  const debtorListCache = students.filter((s) =>
    (s.account_balance ?? 0) !== 0 || debits.some((d) => d.studentId === s.id)
  );

  const filteredDebtors = debtorListCache.filter((s) => {
    const q = debtorSearch.toLowerCase();
    return s.name.toLowerCase().includes(q) ||
      s.studentId.toLowerCase().includes(q) ||
      (s.batch || '').toLowerCase().includes(q);
  });

  // Unique list of batches
  const uniqueBatches = [...new Set(students.map((s) => s.batch).filter(Boolean))].sort();

  // Autocomplete student filter for Debits Search
  const filteredDebitDropdownStudents = students.filter((s) => {
    const q = debitSearchInput.toLowerCase();
    const isAlreadySelected = debitSelectedStudents.some((selected) => selected.id === s.id);
    return !isAlreadySelected && (s.name.toLowerCase().includes(q) || s.studentId.toLowerCase().includes(q));
  });

  // Autocomplete student filter for Credits Search
  const filteredCreditDropdownStudents = students.filter((s) => {
    const q = creditSearchInput.toLowerCase();
    return s.name.toLowerCase().includes(q) || s.studentId.toLowerCase().includes(q);
  });

  // Dashboard calculations
  const totalRevenue = revenue.reduce((sum, r) => sum + r.amount, 0);
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);

  // Group by composite key (date + title) and sort newest first
  const groupRevenueByDateAndTitle = (data) => {
    return data.reduce((acc, r) => {
      const d = r.date || (r.createdAt ? r.createdAt.split('T')[0] : new Date().toISOString().split('T')[0]);
      const isPrint = (r.description === 'Print' || r.source === 'Student Debit') && r.source !== 'Manual Credit';
      const groupedTitle = isPrint ? 'Daily Print Revenue' : (r.title || 'General Revenue');

      const key = isPrint ? (d + '|' + groupedTitle) : (d + '|' + r.id + '|' + groupedTitle);
      if (!acc[key]) {
        acc[key] = {
          date: d,
          title: groupedTitle,
          amount: 0,
          isPrint: isPrint,
          source: isPrint ? 'Print' : (r.source || 'Direct'),
          id: isPrint ? null : r.id,
          notes: isPrint ? '' : (r.notes || '')
        };
      }
      acc[key].amount += parseFloat(r.amount || 0);
      return acc;
    }, {});
  };

  const groupedRevenueList = Object.values(groupRevenueByDateAndTitle(revenue)).sort((a, b) => {
    if (a.date !== b.date) {
      return b.date.localeCompare(a.date);
    }
    return a.title.localeCompare(b.title);
  });

  const recentRevenueGrouped = Object.values(
    revenue
      .filter((r) => {
        const src = (r.source || '').toLowerCase();
        return src === 'direct cash' || src === 'fee payment';
      })
      .reduce((acc, r) => {
        const d = r.date || (r.createdAt ? r.createdAt.split('T')[0] : new Date().toISOString().split('T')[0]);
        acc[d] = (acc[d] || 0) + parseFloat(r.amount || 0);
        return acc;
      }, {})
  )
    .sort((a, b) => b.localeCompare(a))
    .slice(0, 5);

  const recentExpenses = [...expenses].reverse().slice(0, 5);

  return (
    <>
      <Head>
        <title>Admin Dashboard — Lab Accounts</title>
        <meta name="description" content="Lab Accounts Admin Dashboard — Manage students, finances, and reports." />
      </Head>



      {/* Toast container */}
      <div className="toast-container">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.type}`}>
            {t.type === 'success' ? '✅' : t.type === 'error' ? '❌' : 'ℹ️'} {t.message}
          </div>
        ))}
      </div>

      <div className="dashboard">
        {/* Sidebar */}
        <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
          <div className="sidebar-logo">
            <div className="logo-mark">
              <div className="logo-icon-sm">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="3" width="20" height="14" rx="2"/>
                  <line x1="8" y1="21" x2="16" y2="21"/>
                  <line x1="12" y1="17" x2="12" y2="21"/>
                </svg>
              </div>
              <div className="logo-text">Lab Accounts <span>Admin Panel</span></div>
            </div>
            <button className="btn btn-outline btn-sm sidebar-close" style={{ display: 'none' }} onClick={() => setSidebarOpen(false)}>✕</button>
          </div>

          <nav className="nav-section">
            <div className="nav-label">Overview</div>
            <div className={`nav-item ${activeSection === 'dashboard' ? 'active' : ''}`} onClick={() => { setActiveSection('dashboard'); setSidebarOpen(false); }}>
              <span className="nav-icon">📊</span> Dashboard
            </div>

            <div className="nav-label">Students</div>
            <div className={`nav-item ${activeSection === 'students' ? 'active' : ''}`} onClick={() => { setActiveSection('students'); setSidebarOpen(false); }}>
              <span className="nav-icon">🎓</span> All Students
            </div>
            <div className={`nav-item ${activeSection === 'register' ? 'active' : ''}`} onClick={() => { setActiveSection('register'); setSidebarOpen(false); }}>
              <span className="nav-icon">➕</span> Register Student
            </div>
            <div className={`nav-item ${activeSection === 'bulk' ? 'active' : ''}`} onClick={() => { setActiveSection('bulk'); setSidebarOpen(false); }}>
              <span className="nav-icon">📋</span> Bulk Register
            </div>

            <div className="nav-label">Finance</div>
            <div className={`nav-item ${activeSection === 'revenue' ? 'active' : ''}`} onClick={() => { setActiveSection('revenue'); setSidebarOpen(false); }}>
              <span className="nav-icon">💰</span> Revenue
            </div>
            <div className={`nav-item ${activeSection === 'expenses' ? 'active' : ''}`} onClick={() => { setActiveSection('expenses'); setSidebarOpen(false); }}>
              <span className="nav-icon">💸</span> Expenses
            </div>
            <div className={`nav-item ${activeSection === 'debits' ? 'active' : ''}`} onClick={() => { setActiveSection('debits'); setSidebarOpen(false); }}>
              <span className="nav-icon">📒</span> Debit Book
            </div>

            <div className="nav-label">Reports</div>
            <div className={`nav-item ${activeSection === 'reports' ? 'active' : ''}`} onClick={() => { setActiveSection('reports'); setSidebarOpen(false); }}>
              <span className="nav-icon">📈</span> Reports
            </div>
          </nav>

          <div className="sidebar-footer">
            <div className="user-card">
              <div className="user-avatar">{currentUser.name ? currentUser.name[0].toUpperCase() : 'A'}</div>
              <div className="user-info">
                <div className="user-name">{currentUser.name || 'Admin'}</div>
                <div className="user-role">Administrator</div>
              </div>
            </div>
            <button className="btn btn-outline btn-full btn-sm" onClick={handleLogoutClick}>🚪 Sign Out</button>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="main-content" style={{ marginLeft: '260px', transition: 'margin 0.3s ease' }}>
          <div className="topbar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <button 
                className="btn btn-outline btn-sm hamburger-menu" 
                style={{ display: 'none' }} 
                onClick={() => setSidebarOpen(true)}
              >
                ☰
              </button>
              <div>
                <div className="topbar-title" style={{ textTransform: 'capitalize' }}>
                  {activeSection === 'debits' ? 'Debit Book' : activeSection === 'bulk' ? 'Bulk Register' : activeSection}
                </div>
                <div className="topbar-subtitle">
                  {activeSection === 'dashboard' && 'Overview of lab finances'}
                  {activeSection === 'students' && 'Manage student records'}
                  {activeSection === 'register' && 'Add a new student'}
                  {activeSection === 'bulk' && 'Import multiple students via CSV'}
                  {activeSection === 'revenue' && 'Track incoming funds'}
                  {activeSection === 'expenses' && 'Track outgoing funds'}
                  {activeSection === 'debits' && 'Student debits and dues'}
                  {activeSection === 'reports' && 'Financial summaries and exports'}
                </div>
              </div>
            </div>
            <button className="btn btn-outline btn-sm" onClick={() => loadAllData(true)} disabled={loading}>
              {loading ? '🔄 Loading...' : '🔄 Refresh'}
            </button>
          </div>

          <div className="page-content" style={{ padding: '1.5rem' }}>
            {/* Loading Cover */}
            {loading && (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem 0' }}>
                <div className="spinner-inline" style={{ width: '2rem', height: '2rem' }}></div>
              </div>
            )}

            {!loading && (
              <>
                {/* ── DASHBOARD SECTION ── */}
                {activeSection === 'dashboard' && (
                  <div className="section active" id="section-dashboard">
                    <div className="stats-grid">
                      <div className="stat-card green">
                        <span className="stat-icon">💰</span>
                        <div className="stat-label">Cash in Hand</div>
                        <div className={`stat-value ${financialSummary.cashInHand < 0 ? 'text-danger' : 'text-success'}`}>
                          {fmt(financialSummary.cashInHand)}
                        </div>
                        <div className="stat-sub">Starting Cash + Revenue - Expenses</div>
                      </div>
                      <div className="stat-card red">
                        <span className="stat-icon">💸</span>
                        <div className="stat-label">Total Expenses</div>
                        <div className="stat-value">{fmt(financialSummary.totalExpenses)}</div>
                        <div className="stat-sub">Total outgoing payments</div>
                      </div>
                      <div className="stat-card orange">
                        <span className="stat-icon">📒</span>
                        <div className="stat-label">Total Pending Debtors</div>
                        <div className="stat-value" style={{ color: '#f97316' }}>{fmt(financialSummary.pendingDebits)}</div>
                        <div className="stat-sub">Outstanding student balances</div>
                      </div>
                      <div className="stat-card blue">
                        <span className="stat-icon">📊</span>
                        <div className="stat-label">Total Net Worth / Assets</div>
                        <div className={`stat-value ${financialSummary.netWorth < 0 ? 'text-danger' : 'text-success'}`}>
                          {fmt(financialSummary.netWorth)}
                        </div>
                        <div className="stat-sub">Cash in Hand + Pending Debtors</div>
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', marginTop: '1.5rem' }} className="responsive-grid-1col">
                      <div className="panel">
                        <div className="panel-header">
                          <div className="panel-title">📋 Recent Revenue (Cash)</div>
                        </div>
                        <div className="panel-body">
                          {recentRevenueGrouped.length > 0 ? (
                            recentRevenueGrouped.map((val, idx) => (
                              <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '.55rem 0', borderBottom: '1px solid var(--border)', fontSize: '.85rem' }}>
                                <span>
                                  <strong>{fmtDate(revenue.find(r => (r.date || r.createdAt?.split('T')[0]) === val)?.date || val)}</strong>
                                  <span className="badge badge-success" style={{ marginLeft: '.5rem' }}>Cash Revenue</span>
                                </span>
                                <strong className="text-success">{fmt(revenue.filter(r => (r.date || r.createdAt?.split('T')[0]) === val && ((r.source || '').toLowerCase() === 'direct cash' || (r.source || '').toLowerCase() === 'fee payment')).reduce((sum, r) => sum + r.amount, 0))}</strong>
                              </div>
                            ))
                          ) : (
                            <div className="text-muted" style={{ fontSize: '.85rem' }}>No cash revenue entries yet.</div>
                          )}
                        </div>
                      </div>

                      <div className="panel">
                        <div className="panel-header">
                          <div className="panel-title">📋 Recent Expenses</div>
                        </div>
                        <div className="panel-body">
                          {recentExpenses.length > 0 ? (
                            recentExpenses.map((e) => (
                              <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '.5rem 0', borderBottom: '1px solid var(--border)', fontSize: '.85rem' }}>
                                <span>{e.title} <span className="badge badge-danger" style={{ marginLeft: '.4rem' }}>{e.category || 'General'}</span></span>
                                <strong className="text-danger">{fmt(e.amount)}</strong>
                              </div>
                            ))
                          ) : (
                            <div className="text-muted" style={{ fontSize: '.85rem' }}>No expense entries yet.</div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* ── STUDENTS SECTION ── */}
                {activeSection === 'students' && (
                  <div className="section active" id="section-students">
                    <div className="table-wrapper">
                      <div className="table-header" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div className="table-title">🎓 All Students ({filteredStudents.length})</div>
                        <div className="table-actions" style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                          <input
                            className="search-input"
                            value={studentSearch}
                            onChange={(e) => setStudentSearch(e.target.value)}
                            placeholder="🔍 Search students…"
                          />
                          <select
                            className="search-input"
                            value={studentBatchFilter}
                            onChange={(e) => setStudentBatchFilter(e.target.value)}
                            style={{ width: 'auto', minWidth: '130px', height: '38px', cursor: 'pointer', padding: '0 0.75rem' }}
                          >
                            <option value="all">All Batches</option>
                            {uniqueBatches.map((b) => (
                              <option key={b} value={b}>{b}</option>
                            ))}
                          </select>
                          <button className="btn btn-primary btn-sm" onClick={() => setActiveSection('register')}>➕ Add Student</button>
                          <button className="btn btn-danger btn-sm" onClick={() => { setDelallConfirmInput(''); setDelallModalAlert(null); setActiveModal('delete-all-students-modal'); }}>🗑️ Wipe Accounts</button>
                        </div>
                      </div>
                      <div style={{ overflowX: 'auto' }}>
                        <table>
                          <thead>
                            <tr>
                              <th>Student ID</th>
                              <th>Name</th>
                              <th>Batch</th>
                              <th>Phone</th>
                              <th>Password</th>
                              <th>Balance</th>
                              <th style={{ textAlign: 'right' }}>Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredStudents.length > 0 ? (
                              filteredStudents.map((s) => {
                                const bal = s.account_balance ?? 0;
                                const balColor = bal > 0 ? '#f87171' : bal < 0 ? '#34d399' : 'var(--text-muted)';
                                const balLabel = bal > 0 ? `Due: ${fmt(Math.abs(bal))}` : bal < 0 ? `Adv: ${fmt(Math.abs(bal))}` : 'Cleared';

                                return (
                                  <tr key={s.id}>
                                    <td><span className="badge badge-purple">{s.studentId}</span></td>
                                    <td><strong>{s.name}</strong></td>
                                    <td>{s.batch || <span style={{ color: 'var(--text-muted)' }}>—</span>}</td>
                                    <td>{s.phone || <span style={{ color: 'var(--text-muted)' }}>—</span>}</td>
                                    <td style={{ fontFamily: 'monospace', color: 'var(--text-muted)' }}>
                                      {s.password ? (
                                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                                          <span style={{ fontSize: visiblePasswords[s.id] ? 'inherit' : '1rem', letterSpacing: visiblePasswords[s.id] ? 'normal' : '1.5px', verticalAlign: 'middle' }}>
                                            {visiblePasswords[s.id] ? s.password : '••••••'}
                                          </span>
                                          <button
                                            type="button"
                                            onClick={() => setVisiblePasswords(prev => ({ ...prev, [s.id]: !prev[s.id] }))}
                                            style={{
                                              background: 'none',
                                              border: 'none',
                                              cursor: 'pointer',
                                              padding: '4px',
                                              display: 'inline-flex',
                                              alignItems: 'center',
                                              justifyContent: 'center',
                                              color: visiblePasswords[s.id] ? 'var(--accent)' : 'var(--text-muted)',
                                              opacity: visiblePasswords[s.id] ? 1 : 0.5,
                                              transition: 'color 0.2s, opacity 0.2s'
                                            }}
                                            title={visiblePasswords[s.id] ? "Hide Password" : "Show Password"}
                                          >
                                            {visiblePasswords[s.id] ? (
                                              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                                                <circle cx="12" cy="12" r="3" />
                                              </svg>
                                            ) : (
                                              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                                                <line x1="1" y1="1" x2="23" y2="23" />
                                              </svg>
                                            )}
                                          </button>
                                        </div>
                                      ) : (
                                        <span style={{ color: 'var(--text-muted)' }}>—</span>
                                      )}
                                    </td>
                                    <td style={{ fontWeight: 700, color: balColor }}>{balLabel}</td>
                                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                                      <button className="quick-btn qb-edit" onClick={() => handleOpenEditStudent(s)} title="Edit Student" style={{ marginRight: '4px' }}>✏️</button>
                                      <button className="quick-btn qb-del" onClick={() => handleDeleteStudentClick(s.id)} title="Delete Student">🗑️</button>
                                    </td>
                                  </tr>
                                );
                              })
                            ) : (
                              <tr>
                                <td colSpan="7">
                                  <div className="empty-state">
                                    <div className="empty-icon">🎓</div>No students found matching your filters.
                                  </div>
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}

                {/* ── REGISTER SECTION ── */}
                {activeSection === 'register' && (
                  <div className="section active" id="section-register">
                    <div className="panel w-full max-w-md mx-auto">
                      <div className="panel-header">
                        <div className="panel-title">➕ Register New Student</div>
                      </div>
                      <div className="panel-body p-4 lg:p-6">
                        <form onSubmit={handleRegisterSubmit}>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                            <div className="form-group">
                              <label>Full Name *</label>
                              <input
                                className="form-control w-full h-11 px-4 py-2 border border-gray-300 rounded-md"
                                value={regName}
                                onChange={(e) => setRegName(e.target.value)}
                                onBlur={(e) => setRegName(toTitleCase(e.target.value))}
                                required
                                placeholder="e.g. Anfaz Ahamed"
                              />
                            </div>
                            <div className="form-group">
                              <label>Student ID * <small style={{ color: 'var(--text-muted)' }}>(used to login)</small></label>
                              <input
                                className="form-control w-full h-11 px-4 py-2 border border-gray-300 rounded-md"
                                value={regStudentId}
                                onChange={(e) => setRegStudentId(e.target.value.toLowerCase())}
                                required
                                placeholder="e.g. 2024cs001"
                              />
                            </div>
                            <div className="form-group">
                              <label>Batch</label>
                              <input
                                className="form-control w-full h-11 px-4 py-2 border border-gray-300 rounded-md"
                                value={regBatch}
                                onChange={(e) => setRegBatch(e.target.value)}
                                placeholder="Select or type batch..."
                                list="batch-list"
                              />
                            </div>
                            <div className="form-group">
                              <label>Phone</label>
                              <input
                                className="form-control w-full h-11 px-4 py-2 border border-gray-300 rounded-md"
                                value={regPhone}
                                onChange={(e) => setRegPhone(e.target.value)}
                                placeholder="+91 9876543210"
                              />
                            </div>
                            <div className="form-group sm:col-span-2">
                              <label>Password *</label>
                              <input
                                className="form-control w-full h-11 px-4 py-2 border border-gray-300 rounded-md"
                                value={regPassword}
                                onChange={(e) => setRegPassword(e.target.value)}
                                type="password"
                                required
                                placeholder="Student login password"
                              />
                            </div>
                            {regAlert && (
                              <div className={`alert alert-${regAlert.type} sm:col-span-2`} style={{ marginBottom: 0 }}>
                                {regAlert.type === 'success' ? '✅' : '⚠️'} {regAlert.text}
                              </div>
                            )}
                            <button className="btn btn-primary w-full sm:col-span-2 flex justify-center items-center h-11" type="submit" disabled={regLoading}>
                              {regLoading ? 'Processing...' : '✅ Register Student'}
                            </button>
                          </div>
                        </form>
                      </div>
                    </div>
                  </div>
                )}

                {/* ── BULK REGISTER SECTION ── */}
                {activeSection === 'bulk' && (
                  <div className="section active" id="section-bulk">
                    <div className="panel" style={{ maxWidth: '760px' }}>
                      <div className="panel-header">
                        <div className="panel-title">📋 Bulk Student Registration</div>
                        <button className="btn btn-outline btn-sm" onClick={downloadCSVTemplate}>⬇ Download Template</button>
                      </div>
                      <div className="panel-body">
                        <p className="text-muted mb-2" style={{ fontSize: '.85rem' }}>
                          Upload a CSV file or paste data below. Format: <code style={{ color: 'var(--accent-2)' }}>name,studentId,batch,phone,password,openingBalance</code>
                          <br />
                          <span style={{ fontSize: '.78rem', opacity: '.7' }}>Leave <code>openingBalance</code> as <code>0</code> if the student has no existing due.</span>
                        </p>
                        <div className="form-group">
                          <label>Upload CSV File</label>
                          <input className="form-control" type="file" accept=".csv" onChange={handleCSVUpload} />
                        </div>
                        <div className="form-group">
                          <label>Or Paste CSV Data</label>
                          <textarea
                            className="form-control"
                            value={bulkText}
                            onChange={(e) => setBulkText(e.target.value)}
                            rows="8"
                            placeholder="name,studentId,batch,phone,password,openingBalance&#10;John Doe,STU-001,Batch A,9876543210,pass123,150&#10;Jane Smith,STU-002,Batch B,9123456780,pass456,0"
                          />
                        </div>
                        {bulkAlert && (
                          <div className={`alert alert-${bulkAlert.type}`} style={{ marginBottom: '1rem' }}>
                            {bulkAlert.type === 'success' ? '✅' : '⚠️'} {bulkAlert.text}
                          </div>
                        )}
                        <button className="btn btn-primary" onClick={handleBulkRegisterSubmit} disabled={bulkLoading}>
                          {bulkLoading ? 'Importing...' : '📥 Import Students'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* ── REVENUE SECTION ── */}
                {activeSection === 'revenue' && (
                  <div className="section active" id="section-revenue">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                      <div className="panel w-full max-w-md mx-auto lg:col-span-1">
                        <div className="panel-header">
                          <div className="panel-title">➕ Add Revenue</div>
                        </div>
                        <div className="panel-body p-4 lg:p-6">
                          <form onSubmit={handleAddRevenueSubmit}>
                            <div className="form-group">
                              <label>Transaction Type *</label>
                              <select
                                className="form-control"
                                value={revType}
                                onChange={(e) => { setRevType(e.target.value); setRevStudentId(''); }}
                                required
                              >
                                <option value="Cash">Cash (Direct Income)</option>
                                <option value="Credit">Credit (Student Debit)</option>
                                <option value="Opening Cash">Opening Cash Balance</option>                              </select>
                            </div>
                            {revType === 'Credit' && (
                              <div className="form-group">
                                <label>Student Name *</label>
                                <select
                                  className="form-control"
                                  value={revStudentId}
                                  onChange={(e) => setRevStudentId(e.target.value)}
                                  required
                                >
                                  <option value="" disabled>Select registered student...</option>
                                  {students.map((s) => (
                                    <option key={s.id} value={s.id}>{s.name} ({s.batch || '—'})</option>
                                  ))}
                                </select>
                              </div>
                            )}
                            <div className="form-group">
                              <label>Title *</label>
                              <input
                                className="form-control"
                                value={revTitle}
                                onChange={(e) => setRevTitle(e.target.value)}
                                required
                                placeholder="Revenue title"
                              />
                            </div>
                            <div className="form-group">
                              <label>Amount (₹) *</label>
                              <input
                                className="form-control"
                                value={revAmount}
                                onChange={(e) => setRevAmount(e.target.value)}
                                type="number"
                                required
                                min="0"
                                placeholder="0"
                              />
                            </div>
                            <div className="form-group">
                              <label>Date</label>
                              <input
                                className="form-control"
                                value={revDate}
                                onChange={(e) => setRevDate(e.target.value)}
                                type="date"
                              />
                            </div>
                            <div className="form-group">
                              <label>Notes</label>
                              <textarea
                                className="form-control"
                                value={revNotes}
                                onChange={(e) => setRevNotes(e.target.value)}
                                rows="2"
                                placeholder="Optional notes…"
                              />
                            </div>
                            {revAlert && (
                              <div className={`alert alert-${revAlert.type}`} style={{ marginBottom: '1rem' }}>
                                {revAlert.type === 'success' ? '✅' : '⚠️'} {revAlert.text}
                              </div>
                            )}
                            <button className="btn btn-success btn-full" type="submit" disabled={revLoading}>
                              {revLoading ? 'Saving...' : '💰 Add Revenue'}
                            </button>
                          </form>
                        </div>
                      </div>
                      <div className="table-wrapper lg:col-span-2">
                        <div className="table-header">
                          <div className="table-title">💰 Revenue Entries</div>
                          <div className="badge badge-success">Total: {fmt(totalRevenue)}</div>
                        </div>
                        <div className="desktop-only" style={{ overflowX: 'auto' }}>
                          <table>
                            <thead>
                              <tr>
                                <th>Title</th>
                                <th>Source</th>
                                <th style={{ textAlign: 'right' }}>Amount</th>
                                <th>Date</th>
                              </tr>
                            </thead>
                            <tbody>
                              {groupedRevenueList.length > 0 ? (
                                groupedRevenueList.map((t, idx) => (
                                  <tr key={idx}>
                                    <td>
                                      <strong>
                                        {t.isPrint ? (
                                          <span
                                            onClick={() => handleOpenDailyStatement(t.date)}
                                            style={{ color: 'var(--accent-2)', cursor: 'pointer', fontWeight: 600 }}
                                          >
                                            Daily Print Revenue
                                          </span>
                                        ) : (
                                          <span
                                            onClick={() => handleOpenRevenueDetail(revenue.find((r) => r.id === t.id))}
                                            style={{ color: 'var(--text-primary)', cursor: 'pointer', fontWeight: 600 }}
                                          >
                                            {t.title}
                                          </span>
                                        )}
                                      </strong>
                                    </td>
                                    <td>
                                      {t.isPrint ? (
                                        <span className="badge badge-success">Print</span>
                                      ) : (
                                        <span className="badge badge-info">{t.source}</span>
                                      )}
                                    </td>
                                    <td className="text-success fw-bold" style={{ textAlign: 'right' }}>{fmt(t.amount)}</td>
                                    <td className="td-muted">{fmtDate(t.date)}</td>
                                  </tr>
                                ))
                              ) : (
                                <tr>
                                  <td colSpan="4">
                                    <div className="empty-state">
                                      <div className="empty-icon">💰</div>No revenue entries yet.
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>

                        {/* Mobile card list for Revenue Entries */}
                        <div className="mobile-only statement-card-list">
                          {groupedRevenueList.length > 0 ? (
                            groupedRevenueList.map((t, idx) => (
                              <div key={idx} className="statement-card">
                                <div className="statement-card-header">
                                  <span className="statement-card-student">
                                    {t.isPrint ? (
                                      <span
                                        onClick={() => handleOpenDailyStatement(t.date)}
                                        style={{ color: 'var(--accent-2)', cursor: 'pointer', fontWeight: 600 }}
                                      >
                                        Daily Print Revenue
                                      </span>
                                    ) : (
                                      <span
                                        onClick={() => handleOpenRevenueDetail(revenue.find((r) => r.id === t.id))}
                                        style={{ color: 'var(--text-primary)', cursor: 'pointer', fontWeight: 600 }}
                                      >
                                        {t.title}
                                      </span>
                                    )}
                                  </span>
                                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                    {fmtDate(t.date)}
                                  </span>
                                </div>
                                <div className="statement-card-body">
                                  <span className="statement-card-desc">
                                    {t.isPrint ? (
                                      <span className="badge badge-success">Print</span>
                                    ) : (
                                      <span className="badge badge-info">{t.source}</span>
                                    )}
                                  </span>
                                  <span className="statement-card-amount" style={{ color: '#34d399' }}>
                                    {fmt(t.amount)}
                                  </span>
                                </div>
                              </div>
                            ))
                          ) : (
                            <div className="empty-state">
                              <div className="empty-icon">💰</div>No revenue entries yet.
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* ── EXPENSES SECTION ── */}
                {activeSection === 'expenses' && (
                  <div className="section active" id="section-expenses">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                      <div className="panel w-full max-w-md mx-auto lg:col-span-1">
                        <div className="panel-header">
                          <div className="panel-title">➕ Add Expense</div>
                        </div>
                        <div className="panel-body p-4 lg:p-6">
                          <form onSubmit={handleAddExpenseSubmit}>
                            <div className="form-group">
                              <label>Date *</label>
                              <input
                                className="form-control"
                                value={expDate}
                                onChange={(e) => setExpDate(e.target.value)}
                                type="date"
                                required
                              />
                            </div>
                            <div className="form-group">
                              <label>Title *</label>
                              <input
                                className="form-control"
                                value={expTitle}
                                onChange={(e) => setExpTitle(e.target.value)}
                                required
                                placeholder="Expense title"
                              />
                            </div>
                            <div className="form-group">
                              <label>Amount (₹) *</label>
                              <input
                                className="form-control"
                                value={expAmount}
                                onChange={(e) => setExpAmount(e.target.value)}
                                type="number"
                                required
                                min="0"
                                placeholder="0"
                              />
                            </div>
                            <div className="form-group">
                              <label>Notes</label>
                              <textarea
                                className="form-control"
                                value={expNotes}
                                onChange={(e) => setExpNotes(e.target.value)}
                                rows="2"
                                placeholder="Optional notes…"
                              />
                            </div>
                            {expAlert && (
                              <div className={`alert alert-${expAlert.type}`} style={{ marginBottom: '1rem' }}>
                                {expAlert.type === 'success' ? '✅' : '⚠️'} {expAlert.text}
                              </div>
                            )}
                            <button className="btn btn-danger btn-full" type="submit" disabled={expLoading}>
                              {expLoading ? 'Saving...' : '💸 Add Expense'}
                            </button>
                          </form>
                        </div>
                      </div>
                      <div className="table-wrapper lg:col-span-2">
                        <div className="table-header">
                          <div className="table-title">💸 Expense Entries</div>
                          <div className="badge badge-danger">Total: {fmt(totalExpenses)}</div>
                        </div>
                        <div className="desktop-only" style={{ overflowX: 'auto' }}>
                          <table>
                            <thead>
                              <tr>
                                <th>Title</th>
                                <th>Amount</th>
                                <th>Date</th>
                                <th>Notes</th>
                                <th style={{ width: '40px' }}></th>
                              </tr>
                            </thead>
                            <tbody>
                              {expenses.length > 0 ? (
                                [...expenses].reverse().map((e) => (
                                  <tr key={e.id}>
                                    <td><strong>{e.title}</strong></td>
                                    <td className="text-danger fw-bold">{fmt(e.amount)}</td>
                                    <td className="td-muted">{fmtDate(e.date)}</td>
                                    <td className="td-muted">{e.notes || '—'}</td>
                                    <td>
                                      <button className="btn btn-danger btn-sm" onClick={() => handleDeleteExpenseClick(e.id)}>🗑️</button>
                                    </td>
                                  </tr>
                                ))
                              ) : (
                                <tr>
                                  <td colSpan="5">
                                    <div className="empty-state">
                                      <div className="empty-icon">💸</div>No expense entries yet.
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>

                        {/* Mobile card list for Expense Entries */}
                        <div className="mobile-only statement-card-list">
                          {expenses.length > 0 ? (
                            [...expenses].reverse().map((e) => (
                              <div key={e.id} className="statement-card">
                                <div className="statement-card-header">
                                  <span className="statement-card-student">{e.title}</span>
                                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                    {fmtDate(e.date)}
                                  </span>
                                </div>
                                <div className="statement-card-body" style={{ alignItems: 'center' }}>
                                  <span className="statement-card-desc" style={{ fontSize: '0.75rem' }}>
                                    {e.notes || 'No notes'}
                                  </span>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span className="statement-card-amount" style={{ color: '#f87171' }}>
                                      {fmt(e.amount)}
                                    </span>
                                    <button className="btn btn-danger btn-sm" style={{ padding: '0.25rem 0.5rem', minHeight: 'auto', height: '28px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => handleDeleteExpenseClick(e.id)}>🗑️</button>
                                  </div>
                                </div>
                              </div>
                            ))
                          ) : (
                            <div className="empty-state">
                              <div className="empty-icon">💸</div>No expense entries yet.
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* ── DEBITS SECTION (DEBTOR MANAGEMENT) ── */}
                {activeSection === 'debits' && (
                  <div className="section active" id="section-debits">
                    <div className="stats-grid" style={{ marginBottom: '1.5rem' }}>
                      <div className="stat-card orange">
                        <span className="stat-icon">⏳</span>
                        <div className="stat-label">Net Outstanding</div>
                        <div className="stat-value" style={{ color: financialSummary.pendingDebits > 0 ? '#f87171' : financialSummary.pendingDebits < 0 ? '#34d399' : '' }}>
                          {fmt(financialSummary.pendingDebits)}
                        </div>
                      </div>
                    </div>

                    <div className="table-wrapper">
                      <div className="table-header" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div className="table-title">👥 Debtor Management ({filteredDebtors.length})</div>
                        <div className="table-actions" style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                          <input
                            className="search-input"
                            value={debtorSearch}
                            onChange={(e) => setDebtorSearch(e.target.value)}
                            placeholder="🔍 Search students…"
                          />
                          <button className="btn btn-outline btn-sm" onClick={() => loadAllData(true)}>🔄 Refresh</button>
                          <button className="btn btn-outline btn-sm" onClick={handlePrintDebtorReport}>🖨️ Report</button>
                          <button className="btn btn-primary btn-sm" onClick={handleDownloadDebtorCSV}>📥 Download CSV</button>
                        </div>
                      </div>
                      <div style={{ overflowX: 'auto' }}>
                        <table id="debtor-table">
                          <thead>
                            <tr>
                              <th>Student</th>
                              <th>Batch / ID</th>
                              <th style={{ textAlign: 'center' }}>Balance</th>
                              <th style={{ textAlign: 'center' }}>Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredDebtors.length > 0 ? (
                              filteredDebtors.map((s) => {
                                const balance = s.account_balance ?? 0;
                                let pillClass = 'cleared';
                                let pillText = '✅ Cleared';

                                if (balance > 0) {
                                  pillClass = 'due';
                                  pillText = `🔴 Due: ${fmt(balance)}`;
                                } else if (balance < 0) {
                                  pillClass = 'advance';
                                  pillText = `🟢 Adv: ${fmt(Math.abs(balance))}`;
                                }

                                return (
                                  <tr key={s.id}>
                                    <td>
                                      <div className="debtor-name debtor-name-clickable" onClick={() => handleOpenAccountStatement(s)}>{s.name}</div>
                                      <div className="debtor-meta">{[s.course, s.department].filter(Boolean).join(' · ') || '—'}</div>
                                    </td>
                                    <td>
                                      <span className="badge badge-purple">{s.studentId}</span>
                                      {s.batch && <div className="debtor-meta" style={{ marginTop: '3px' }}>{s.batch}</div>}
                                    </td>
                                    <td style={{ textAlign: 'center' }}><span className={`balance-pill ${pillClass}`}>{pillText}</span></td>
                                    <td style={{ textAlign: 'center' }}>
                                      <div className="action-dropdown-container">
                                        <button
                                          className="kebab-btn"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            if (activeKebabStudentId === s.id) {
                                              setActiveKebabStudentId(null);
                                            } else {
                                              const rect = e.currentTarget.getBoundingClientRect();
                                              setActiveKebabStudentId(s.id);
                                              setKebabCoords({
                                                top: rect.bottom + window.scrollY,
                                                left: rect.right - 150 + window.scrollX
                                              });
                                            }
                                          }}
                                          title="Actions"
                                        >
                                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" strokeLinecap="round" strokeLinejoin="round">
                                            <circle cx="12" cy="12" r="1.5"></circle>
                                            <circle cx="12" cy="5" r="1.5"></circle>
                                            <circle cx="12" cy="19" r="1.5"></circle>
                                          </svg>
                                        </button>

                                        {activeKebabStudentId === s.id && (
                                          <div
                                            className="action-dropdown-menu show"
                                            style={{
                                              position: 'fixed',
                                              top: kebabCoords.top,
                                              left: kebabCoords.left,
                                              zIndex: 1000
                                            }}
                                            onClick={(e) => e.stopPropagation()}
                                          >
                                            <button className="dropdown-item qb-charge" onClick={() => { setActiveKebabStudentId(null); handleOpenQuickCharge(s); }}>📤 Charge</button>
                                            <button className="dropdown-item qb-collect" onClick={() => { setActiveKebabStudentId(null); handleOpenQuickCollect(s); }}>📥 Collect</button>
                                            {balance > 0 && (
                                              <button className="dropdown-item qb-whatsapp" onClick={() => { setActiveKebabStudentId(null); sendWhatsAppReminder(s.name, balance, s.phone); }}>💬 Remind</button>
                                            )}
                                            <button className="dropdown-item qb-del" onClick={() => { setActiveKebabStudentId(null); handleDeleteStudentClick(s.id); }}>🗑️ Delete Account</button>
                                          </div>
                                        )}
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })
                            ) : (
                              <tr>
                                <td colSpan="4">
                                  <div className="empty-state">
                                    <div className="empty-icon">👥</div>No debit/credit activity yet. Use the FAB buttons to get started.
                                  </div>
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* FAB Buttons */}
                    <div className="debit-fab-container">
                      <button className="debit-fab fab-credit" onClick={handleOpenCreditModal} title="Record a student payment">
                        📥 Add Credit
                      </button>
                      <button className="debit-fab fab-debit" onClick={handleOpenDebitModal} title="Charge a student account">
                        📤 Add Debit
                      </button>
                    </div>
                  </div>
                )}

                {/* ── REPORTS SECTION ── */}
                {activeSection === 'reports' && (
                  <div className="section active" id="section-reports">
                    <div className="panel" style={{ marginBottom: '1.5rem' }}>
                      <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                        {/* Monthly report month picker */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                          <label htmlFor="report-month-picker" style={{ fontWeight: 600, width: '135px', display: 'inline-block', flexShrink: 0, margin: 0 }}>Select Month:</label>
                          <input
                            type="month"
                            id="report-month-picker"
                            className="form-control"
                            style={{ width: '180px', margin: 0 }}
                            value={reportMonthPicker}
                            onChange={(e) => setReportMonthPicker(e.target.value)}
                          />
                          <button className="btn btn-primary" onClick={handlePrintMonthlyReport}>
                            🖨️ Print Monthly Report
                          </button>
                        </div>

                        {/* Custom date range picker */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                          <label style={{ fontWeight: 600, width: '135px', display: 'inline-block', flexShrink: 0, margin: 0 }}>Date Range:</label>
                          <input
                            type="date"
                            className="form-control"
                            style={{ width: '140px', margin: 0 }}
                            value={reportFromDate}
                            onChange={(e) => setReportFromDate(e.target.value)}
                          />
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>to</span>
                          <input
                            type="date"
                            className="form-control"
                            style={{ width: '140px', margin: 0 }}
                            value={reportToDate}
                            onChange={(e) => setReportToDate(e.target.value)}
                          />
                          <button className="btn btn-outline" onClick={handlePrintCustomReport}>
                            🖨️ Print Custom Report
                          </button>
                        </div>

                        {/* Debtor Directory report */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                          <label style={{ fontWeight: 600, width: '135px', display: 'inline-block', flexShrink: 0, margin: 0 }}>Debtor Directory:</label>
                          <button className="btn btn-outline" onClick={handlePrintDebtorReport}>
                            🖨️ Print Debtor Report
                          </button>
                          <button className="btn btn-primary" onClick={handleDownloadDebtorCSV}>
                            📥 Download CSV
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Stats Grid */}
                    <div className="stats-grid-5">
                      <div className="stat-card blue">
                        <span className="stat-icon">📊</span>
                        <div className="stat-label">Opening Balance</div>
                        <div className="stat-value">{fmt(mrOpeningBalance)}</div>
                      </div>
                      <div className="stat-card green">
                        <span className="stat-icon">💰</span>
                        <div className="stat-label">Total Revenue</div>
                        <div className="stat-value">{fmt(mrRev)}</div>
                      </div>
                      <div className="stat-card red">
                        <span className="stat-icon">💸</span>
                        <div className="stat-label">Total Expenses</div>
                        <div className="stat-value">{fmt(mrExp)}</div>
                      </div>

                      <div className="stat-card purple">
                        <span className="stat-icon">📄</span>
                        <div className="stat-label">B&amp;W Pages</div>
                        <div className="stat-value">{mrBwPages}</div>
                      </div>
                      <div className="stat-card blue">
                        <span className="stat-icon">🎨</span>
                        <div className="stat-label">Colour Pages</div>
                        <div className="stat-value">{mrColourPages}</div>
                      </div>
                    </div>

                    {/* Danger Zone */}
                    <div className="panel" style={{ marginTop: '2rem', border: '1.5px solid #ef4444', background: 'rgba(239, 68, 68, 0.02)' }}>
                      <div className="panel-header" style={{ borderBottom: '1px solid rgba(239, 68, 68, 0.15)' }}>
                        <div className="panel-title" style={{ color: '#ef4444', fontWeight: 700 }}>⚠️ Danger Zone</div>
                      </div>
                      <div className="panel-body" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                        <div>
                          <h4 style={{ margin: 0, fontSize: '0.95rem', color: '#ef4444', fontWeight: 600 }}>Reset All Financial Data</h4>
                          <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                            Permanently delete all revenues, expenses, debits, and reset all student balances to zero. This cannot be undone.
                          </p>
                        </div>
                        <button className="btn btn-danger" onClick={() => { setResetConfirmInput(''); setResetDeleteStudentsCb(false); setResetModalAlert(null); setActiveModal('reset-modal'); }}>
                          🗑️ Reset All Financial Data
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </main>
      </div>

      {/* --- MODAL DIALOGS --- */}

      {/* ── Reset Modal (Danger Zone) ── */}
      {activeModal === 'reset-modal' && (
        <div className="modal-overlay open" onClick={() => setActiveModal(null)}>
          <div className="modal" style={{ maxWidth: '440px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header" style={{ borderBottomColor: 'rgba(239, 68, 68, 0.15)' }}>
              <div className="modal-title" style={{ color: '#ef4444', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span>⚠️</span> Danger Zone Reset
              </div>
              <button className="modal-close" onClick={() => setActiveModal(null)}>✕</button>
            </div>
            <div className="modal-body" style={{ paddingTop: '1.25rem' }}>
              <p style={{ color: '#fca5a5', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '8px', padding: '0.85rem', fontSize: '0.8rem', lineHeight: 1.4, marginBottom: '1.25rem' }}>
                <strong>WARNING:</strong> This will permanently delete all revenues, expenses, and debits, and reset all student balances to zero. To confirm, type the word <strong>'DELETE'</strong> below:
              </p>
              <div style={{ marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.6rem', userSelect: 'none', cursor: 'pointer' }} onClick={() => setResetDeleteStudentsCb(!resetDeleteStudentsCb)}>
                <input type="checkbox" checked={resetDeleteStudentsCb} onChange={(e) => setResetDeleteStudentsCb(e.target.checked)} style={{ width: '16px', height: '16px', cursor: 'pointer' }} onClick={(e) => e.stopPropagation()} />
                <label style={{ margin: 0, fontSize: '0.85rem', color: '#fca5a5', fontWeight: 600, cursor: 'pointer' }}>Also delete all registered student accounts</label>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Type DELETE to confirm"
                  value={resetConfirmInput}
                  onChange={(e) => setResetConfirmInput(e.target.value)}
                  style={{ textAlign: 'center', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase' }}
                />
              </div>
              {resetModalAlert && <div style={{ marginTop: '0.75rem', color: '#ef4444', fontSize: '0.78rem', fontWeight: 600, textAlign: 'center' }}>{resetModalAlert}</div>}
            </div>
            <div className="modal-footer" style={{ borderTopColor: 'rgba(255, 255, 255, 0.05)' }}>
              <button className="btn btn-outline" onClick={() => setActiveModal(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={submitResetModalConfirm}>Confirm Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete All Students Modal ── */}
      {activeModal === 'delete-all-students-modal' && (
        <div className="modal-overlay open" onClick={() => setActiveModal(null)}>
          <div className="modal" style={{ maxWidth: '440px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header" style={{ borderBottomColor: 'rgba(239, 68, 68, 0.15)' }}>
              <div className="modal-title" style={{ color: '#ef4444', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span>⚠️</span> Delete All Student Accounts
              </div>
              <button className="modal-close" onClick={() => setActiveModal(null)}>✕</button>
            </div>
            <div className="modal-body" style={{ paddingTop: '1.25rem' }}>
              <p style={{ color: '#fca5a5', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '8px', padding: '0.85rem', fontSize: '0.8rem', lineHeight: 1.4, marginBottom: '1.25rem' }}>
                <strong>WARNING:</strong> This will permanently delete <strong>ALL</strong> registered student accounts and their credentials. All student transaction histories and balances will also be wiped out. To confirm, type the word <strong>'DELETE ALL'</strong> below:
              </p>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Type DELETE ALL to confirm"
                  value={delallConfirmInput}
                  onChange={(e) => setDelallConfirmInput(e.target.value)}
                  style={{ textAlign: 'center', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase' }}
                />
              </div>
              {delallModalAlert && <div style={{ marginTop: '0.75rem', color: '#ef4444', fontSize: '0.78rem', fontWeight: 600, textAlign: 'center' }}>{delallModalAlert}</div>}
            </div>
            <div className="modal-footer" style={{ borderTopColor: 'rgba(255, 255, 255, 0.05)' }}>
              <button className="btn btn-outline" onClick={() => setActiveModal(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={submitDeleteAllStudentsConfirm}>Confirm Delete All</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Quick Charge Modal ── */}
      {activeModal === 'quick-charge-modal' && modalStudent && (
        <div className="modal-overlay open" onClick={() => setActiveModal(null)}>
          <div className="modal w-full max-w-md mx-auto" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title" style={{ color: '#f87171' }}>📤 Add Charge</div>
              <button className="modal-close" onClick={() => setActiveModal(null)}>✕</button>
            </div>
            <div className="modal-body p-5 lg:p-6">
              <form onSubmit={handleQuickChargeSubmit}>
                <div className="qm-student-tag">
                  <strong>{modalStudent.name}</strong>
                  <span className="qm-meta">{[modalStudent.studentId, modalStudent.batch].filter(Boolean).join(' · ')}</span>
                </div>
                <div className="balance-preview">
                  <span className="bp-label">Current Balance</span>
                  <span className="bp-value" style={{ color: (modalStudent.account_balance ?? 0) > 0 ? '#f87171' : (modalStudent.account_balance ?? 0) < 0 ? '#34d399' : '' }}>
                    {fmt(modalStudent.account_balance)}
                  </span>
                </div>
                <div className="form-group">
                  <label>Description *</label>
                  <input
                    className="form-control"
                    value={qcDescription}
                    onChange={(e) => setQcDescription(e.target.value)}
                    required
                    placeholder="e.g. Lab breakage fee, Exam fee…"
                  />
                </div>
                <div className="form-group">
                  <label>Charge Amount (₹) *</label>
                  <input
                    className="form-control"
                    value={qcAmount}
                    onChange={(e) => setQcAmount(e.target.value)}
                    type="number"
                    required
                    min="1"
                    placeholder="0"
                  />
                </div>
                <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '8px', padding: '.65rem .9rem', fontSize: '.78rem', color: '#fca5a5', marginBottom: '1rem' }}>
                  ⚠️ This will <strong>increase</strong> the student's outstanding balance.
                </div>
                {qcAlert && (
                  <div className={`alert alert-${qcAlert.type}`} style={{ marginBottom: '1rem' }}>
                    ⚠️ {qcAlert.text}
                  </div>
                )}
                <div className="modal-footer" style={{ padding: 0, marginTop: '1rem' }}>
                  <button className="btn btn-outline" type="button" onClick={() => setActiveModal(null)}>Cancel</button>
                  <button className="btn btn-danger" type="submit" disabled={qcLoading}>
                    {qcLoading ? 'Processing...' : '📤 Add Charge'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ── Quick Collect Modal ── */}
      {activeModal === 'quick-collect-modal' && modalStudent && (
        <div className="modal-overlay open" onClick={() => setActiveModal(null)}>
          <div className="modal w-full max-w-md mx-auto" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title" style={{ color: '#34d399' }}>📥 Log Collection</div>
              <button className="modal-close" onClick={() => setActiveModal(null)}>✕</button>
            </div>
            <div className="modal-body p-5 lg:p-6">
              <form onSubmit={handleQuickCollectSubmit}>
                <div className="qm-student-tag">
                  <strong>{modalStudent.name}</strong>
                  <span className="qm-meta">{[modalStudent.studentId, modalStudent.batch].filter(Boolean).join(' · ')}</span>
                </div>
                <div className="balance-preview">
                  <span className="bp-label">Current Balance</span>
                  <span className="bp-value" style={{ color: (modalStudent.account_balance ?? 0) > 0 ? '#f87171' : (modalStudent.account_balance ?? 0) < 0 ? '#34d399' : '' }}>
                    {fmt(modalStudent.account_balance)}
                  </span>
                </div>
                <div className="form-group">
                  <label>Description *</label>
                  <input
                    className="form-control"
                    value={qlDescription}
                    onChange={(e) => setQlDescription(e.target.value)}
                    required
                    placeholder="e.g. Term fee payment, Instalment…"
                  />
                </div>
                <div className="form-group">
                  <label>Amount Received (₹) *</label>
                  <input
                    className="form-control"
                    value={qlAmount}
                    onChange={(e) => setQlAmount(e.target.value)}
                    type="number"
                    required
                    min="1"
                    placeholder="0"
                  />
                </div>
                <div style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '8px', padding: '.65rem .9rem', fontSize: '.78rem', color: '#6ee7b7', marginBottom: '1rem' }}>
                  ✅ This will <strong>reduce</strong> the student's outstanding balance.
                </div>
                {qlAlert && (
                  <div className={`alert alert-${qlAlert.type}`} style={{ marginBottom: '1rem' }}>
                    ⚠️ {qlAlert.text}
                  </div>
                )}
                <div className="modal-footer" style={{ padding: 0, marginTop: '1rem' }}>
                  <button className="btn btn-outline" type="button" onClick={() => setActiveModal(null)}>Cancel</button>
                  <button className="btn btn-success" type="submit" disabled={qlLoading}>
                    {qlLoading ? 'Processing...' : '📥 Log Collection'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ── Add Debit Modal (Print Cost Calculator) ── */}
      {activeModal === 'debit-modal' && (
        <div className="modal-overlay open" onClick={() => setActiveModal(null)}>
          <div className="modal w-full max-w-md mx-auto" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title" style={{ color: '#f87171' }}>📤 Add Debit (Print Cost Calculator)</div>
              <button className="modal-close" onClick={() => setActiveModal(null)}>✕</button>
            </div>
            <div className="modal-body p-5 lg:p-6">
              <form onSubmit={handleDebitModalSubmit}>
                {showInlineRegister ? (
                  <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', borderRadius: '8px', padding: '1rem', marginBottom: '1.25rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                      <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 600, color: 'var(--accent)' }}>➕ Register New Student</h4>
                      <button type="button" className="modal-close" style={{ fontSize: '1rem', padding: 0 }} onClick={() => setShowInlineRegister(false)}>✕</button>
                    </div>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label style={{ fontSize: '0.75rem' }}>Full Name *</label>
                        <input
                          type="text"
                          className="form-control"
                          style={{ height: '36px', fontSize: '0.82rem', padding: '0.5rem' }}
                          value={inlineRegName}
                          onChange={(e) => setInlineRegName(e.target.value)}
                          onBlur={(e) => setInlineRegName(toTitleCase(e.target.value))}
                          required={showInlineRegister}
                          placeholder="e.g. Anfaz Ahamed"
                        />
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label style={{ fontSize: '0.75rem' }}>Student ID *</label>
                        <input
                          type="text"
                          className="form-control"
                          style={{ height: '36px', fontSize: '0.82rem', padding: '0.5rem' }}
                          value={inlineRegStudentId}
                          onChange={(e) => setInlineRegStudentId(e.target.value.toLowerCase())}
                          required={showInlineRegister}
                          placeholder="e.g. 2024cs001"
                        />
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label style={{ fontSize: '0.75rem' }}>Batch</label>
                        <input
                          type="text"
                          className="form-control"
                          style={{ height: '36px', fontSize: '0.82rem', padding: '0.5rem' }}
                          value={inlineRegBatch}
                          onChange={(e) => setInlineRegBatch(e.target.value)}
                          placeholder="Batch name"
                          list="batch-list"
                        />
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label style={{ fontSize: '0.75rem' }}>Phone</label>
                        <input
                          type="text"
                          className="form-control"
                          style={{ height: '36px', fontSize: '0.82rem', padding: '0.5rem' }}
                          value={inlineRegPhone}
                          onChange={(e) => setInlineRegPhone(e.target.value)}
                          placeholder="+91 98765..."
                        />
                      </div>
                      <div className="form-group" style={{ gridColumn: 'span 2', marginBottom: 0 }}>
                        <label style={{ fontSize: '0.75rem' }}>Password *</label>
                        <input
                          type="password"
                          className="form-control"
                          style={{ height: '36px', fontSize: '0.82rem', padding: '0.5rem' }}
                          value={inlineRegPassword}
                          onChange={(e) => setInlineRegPassword(e.target.value)}
                          required={showInlineRegister}
                          placeholder="Password"
                        />
                      </div>
                    </div>

                    {inlineRegAlert && (
                      <div className={`alert alert-${inlineRegAlert.type}`} style={{ padding: '0.5rem 0.75rem', fontSize: '0.75rem', marginTop: '0.75rem', marginBottom: 0 }}>
                        {inlineRegAlert.type === 'success' ? '✅' : '⚠️'} {inlineRegAlert.text}
                      </div>
                    )}

                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                      <button type="button" className="btn btn-outline btn-sm" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setShowInlineRegister(false)}>Cancel</button>
                      <button type="button" className="btn btn-primary btn-sm" style={{ flex: 1, justifyContent: 'center' }} onClick={handleInlineRegisterSubmit} disabled={inlineRegLoading}>
                        {inlineRegLoading ? 'Saving...' : 'Register & Select'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="form-group">
                    <label>Search Student *</label>
                    <div className="student-search-wrap">
                      <input
                        type="text"
                        className="student-search-input"
                        value={debitSearchInput}
                        onChange={(e) => {
                          setDebitSearchInput(e.target.value);
                          setDebitDropdownOpen(true);
                        }}
                        onFocus={(e) => {
                          e.stopPropagation();
                          setDebitDropdownOpen(true);
                        }}
                        onClick={(e) => e.stopPropagation()}
                        placeholder="Type name or Student ID…"
                        autoComplete="off"
                      />
                      {debitDropdownOpen && (
                        <div className="student-dropdown open" onClick={(e) => e.stopPropagation()}>
                          {filteredDebitDropdownStudents.length > 0 ? (
                            filteredDebitDropdownStudents.map((s) => (
                              <div key={s.id} className="student-opt" onClick={() => { setDebitSelectedStudents(prev => [...prev, s]); setDebitSearchInput(''); setDebitDropdownOpen(false); }}>
                                <span>{s.name}</span>
                                <span className="opt-id">{s.batch || ''}</span>
                              </div>
                            ))
                          ) : (
                            <div className="student-opt" style={{ color: 'var(--text-muted)', cursor: 'default' }}>No students found</div>
                          )}
                          <div 
                            className="student-opt register-shortcut" 
                            style={{ color: '#6c63ff', fontWeight: 600, borderTop: '1px solid var(--border)', cursor: 'pointer' }} 
                            onClick={() => { 
                              setDebitDropdownOpen(false); 
                              setShowInlineRegister(true); 
                            }}
                          >
                            + Register New Student
                          </div>
                        </div>
                      )}
                    </div>
                    {debitSelectedStudents && debitSelectedStudents.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px' }}>
                        {debitSelectedStudents.map((student) => (
                          <div key={student.id} className="selected-student-tag" style={{ marginTop: 0 }}>
                            🎓 {student.name} {student.batch ? <span className="td-muted">({student.batch})</span> : ''}
                            <button type="button" onClick={() => setDebitSelectedStudents(prev => prev.filter(s => s.id !== student.id))}>✕</button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <div className="form-group">
                  <label>Debit Type *</label>
                  <select className="form-control" value={debitType} onChange={(e) => setDebitType(e.target.value)} required>
                    <option value="bw">Black &amp; White Print</option>
                    <option value="colour">Colour Print</option>

                  </select>
                </div>

                {debitType !== 'opening' && (
                  <>
                    <div className="form-group">
                      <label>Print Side *</label>
                      <select className="form-control" value={debitSide} onChange={(e) => setDebitSide(e.target.value)} required>
                        <option value="one">One Side</option>
                        <option value="two">Two Side</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Number of Pages *</label>
                      <input
                        className="form-control"
                        type="number"
                        min="1"
                        value={debitPages}
                        onChange={(e) => setDebitPages(Math.max(1, parseInt(e.target.value) || 1))}
                        required
                      />
                    </div>
                  </>
                )}

                <div className="form-group">
                  <label>Discount (₹)</label>
                  <input
                    className="form-control"
                    type="number"
                    min="0"
                    value={debitDiscount}
                    onChange={(e) => setDebitDiscount(parseFloat(e.target.value) || 0)}
                  />
                </div>

                <div className="form-group">
                  <label>{debitType === 'opening' ? 'Amount (₹) *' : 'Calculated Amount (₹)'}</label>
                  <input
                    className="form-control"
                    type="number"
                    readOnly={debitType !== 'opening'}
                    value={debitAmount}
                    onChange={(e) => setDebitAmount(parseFloat(e.target.value) || 0)}
                    required
                  />
                </div>

                <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '8px', padding: '.75rem 1rem', fontSize: '.8rem', color: '#fca5a5', marginBottom: '1rem' }}>
                  ⚠️ This will <strong>increase</strong> the student's outstanding balance and log the charge as Revenue.
                </div>

                {debitAlert && (
                  <div className={`alert alert-${debitAlert.type}`} style={{ marginBottom: '1rem' }}>
                    ⚠️ {debitAlert.text}
                  </div>
                )}

                <div className="modal-footer" style={{ padding: 0, marginTop: '1rem' }}>
                  <button className="btn btn-outline" type="button" onClick={() => setActiveModal(null)}>Cancel</button>
                  <button className="btn btn-danger" type="submit" disabled={debitLoading}>
                    {debitLoading ? 'Processing...' : '📤 Add Charge'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ── Add Credit Modal ── */}
      {activeModal === 'credit-modal' && (
        <div className="modal-overlay open" onClick={() => setActiveModal(null)}>
          <div className="modal w-full max-w-md mx-auto" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title" style={{ color: '#34d399' }}>📥 Add Credit to Student</div>
              <button className="modal-close" onClick={() => setActiveModal(null)}>✕</button>
            </div>
            <div className="modal-body p-5 lg:p-6">
              <form onSubmit={handleCreditModalSubmit}>
                {showInlineRegister ? (
                  <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', borderRadius: '8px', padding: '1rem', marginBottom: '1.25rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                      <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 600, color: 'var(--accent)' }}>➕ Register New Student</h4>
                      <button type="button" className="modal-close" style={{ fontSize: '1rem', padding: 0 }} onClick={() => setShowInlineRegister(false)}>✕</button>
                    </div>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label style={{ fontSize: '0.75rem' }}>Full Name *</label>
                        <input
                          type="text"
                          className="form-control"
                          style={{ height: '36px', fontSize: '0.82rem', padding: '0.5rem' }}
                          value={inlineRegName}
                          onChange={(e) => setInlineRegName(e.target.value)}
                          onBlur={(e) => setInlineRegName(toTitleCase(e.target.value))}
                          required={showInlineRegister}
                          placeholder="e.g. Anfaz Ahamed"
                        />
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label style={{ fontSize: '0.75rem' }}>Student ID *</label>
                        <input
                          type="text"
                          className="form-control"
                          style={{ height: '36px', fontSize: '0.82rem', padding: '0.5rem' }}
                          value={inlineRegStudentId}
                          onChange={(e) => setInlineRegStudentId(e.target.value.toLowerCase())}
                          required={showInlineRegister}
                          placeholder="e.g. 2024cs001"
                        />
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label style={{ fontSize: '0.75rem' }}>Batch</label>
                        <input
                          type="text"
                          className="form-control"
                          style={{ height: '36px', fontSize: '0.82rem', padding: '0.5rem' }}
                          value={inlineRegBatch}
                          onChange={(e) => setInlineRegBatch(e.target.value)}
                          placeholder="Batch name"
                          list="batch-list"
                        />
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label style={{ fontSize: '0.75rem' }}>Phone</label>
                        <input
                          type="text"
                          className="form-control"
                          style={{ height: '36px', fontSize: '0.82rem', padding: '0.5rem' }}
                          value={inlineRegPhone}
                          onChange={(e) => setInlineRegPhone(e.target.value)}
                          placeholder="+91 98765..."
                        />
                      </div>
                      <div className="form-group" style={{ gridColumn: 'span 2', marginBottom: 0 }}>
                        <label style={{ fontSize: '0.75rem' }}>Password *</label>
                        <input
                          type="password"
                          className="form-control"
                          style={{ height: '36px', fontSize: '0.82rem', padding: '0.5rem' }}
                          value={inlineRegPassword}
                          onChange={(e) => setInlineRegPassword(e.target.value)}
                          required={showInlineRegister}
                          placeholder="Password"
                        />
                      </div>
                    </div>

                    {inlineRegAlert && (
                      <div className={`alert alert-${inlineRegAlert.type}`} style={{ padding: '0.5rem 0.75rem', fontSize: '0.75rem', marginTop: '0.75rem', marginBottom: 0 }}>
                        {inlineRegAlert.type === 'success' ? '✅' : '⚠️'} {inlineRegAlert.text}
                      </div>
                    )}

                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                      <button type="button" className="btn btn-outline btn-sm" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setShowInlineRegister(false)}>Cancel</button>
                      <button type="button" className="btn btn-primary btn-sm" style={{ flex: 1, justifyContent: 'center' }} onClick={handleInlineRegisterSubmit} disabled={inlineRegLoading}>
                        {inlineRegLoading ? 'Saving...' : 'Register & Select'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="form-group">
                    <label>Search Student *</label>
                    <div className="student-search-wrap">
                      <input
                        type="text"
                        className="student-search-input"
                        value={creditSearchInput}
                        onChange={(e) => {
                          setCreditSearchInput(e.target.value);
                          setCreditDropdownOpen(true);
                        }}
                        onFocus={(e) => {
                          e.stopPropagation();
                          setCreditDropdownOpen(true);
                        }}
                        onClick={(e) => e.stopPropagation()}
                        placeholder="Type name or Student ID…"
                        autoComplete="off"
                      />
                      {creditDropdownOpen && (
                        <div className="student-dropdown open" onClick={(e) => e.stopPropagation()}>
                          {filteredCreditDropdownStudents.length > 0 ? (
                            filteredCreditDropdownStudents.map((s) => (
                              <div key={s.id} className="student-opt" onClick={() => { setCreditSelectedStudent(s); setCreditSearchInput(''); setCreditDropdownOpen(false); }}>
                                <span>{s.name}</span>
                                <span className="opt-id">{s.batch || ''}</span>
                              </div>
                            ))
                          ) : (
                            <div className="student-opt" style={{ color: 'var(--text-muted)', cursor: 'default' }}>No students found</div>
                          )}
                          <div 
                            className="student-opt register-shortcut" 
                            style={{ color: '#6c63ff', fontWeight: 600, borderTop: '1px solid var(--border)', cursor: 'pointer' }} 
                            onClick={() => { 
                              setCreditDropdownOpen(false); 
                              setShowInlineRegister(true); 
                            }}
                          >
                            + Register New Student
                          </div>
                        </div>
                      )}
                    </div>
                    {creditSelectedStudent && (
                      <div className="selected-student-tag">
                        🎓 {creditSelectedStudent.name} {creditSelectedStudent.batch ? <span className="td-muted">({creditSelectedStudent.batch})</span> : ''}
                        <button type="button" onClick={() => setCreditSelectedStudent(null)}>✕</button>
                      </div>
                    )}
                  </div>
                )}

                <div className="form-group">
                  <label>Description *</label>
                  <input
                    className="form-control"
                    value={creditDescription}
                    onChange={(e) => setCreditDescription(e.target.value)}
                    required
                    placeholder="e.g. Term fee payment"
                  />
                </div>
                <div className="form-group">
                  <label>Amount Received (₹) *</label>
                  <input
                    className="form-control"
                    value={creditAmount}
                    onChange={(e) => setCreditAmount(e.target.value)}
                    type="number"
                    required
                    min="1"
                    placeholder="0"
                  />
                </div>

                <div style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '8px', padding: '.75rem 1rem', fontSize: '.8rem', color: '#6ee7b7', marginBottom: '1rem' }}>
                  ✅ This will <strong>reduce</strong> the student's outstanding balance and log the payment as Revenue.
                </div>

                {creditAlert && (
                  <div className={`alert alert-${creditAlert.type}`} style={{ marginBottom: '1rem' }}>
                    ⚠️ {creditAlert.text}
                  </div>
                )}

                <div className="modal-footer" style={{ padding: 0, marginTop: '1rem' }}>
                  <button className="btn btn-outline" type="button" onClick={() => setActiveModal(null)}>Cancel</button>
                  <button className="btn btn-success" type="submit" disabled={creditLoading}>
                    {creditLoading ? 'Recording...' : '📥 Record Credit'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit Student Modal ── */}
      {activeModal === 'edit-student-modal' && modalStudent && (
        <div className="modal-overlay open" onClick={() => setActiveModal(null)}>
          <div className="modal w-full max-w-md mx-auto" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">✏️ Edit Student</div>
              <button className="modal-close" onClick={() => setActiveModal(null)}>✕</button>
            </div>
            <div className="modal-body p-5 lg:p-6">
              <form onSubmit={handleEditStudentSubmit}>
                <div className="form-row">
                  <div className="form-group">
                    <label>Full Name</label>
                    <input className="form-control" value={editName} onChange={(e) => setEditName(e.target.value)} required />
                  </div>
                  <div className="form-group">
                    <label>Student ID</label>
                    <input className="form-control" value={editStudentId} onChange={(e) => setEditStudentId(e.target.value)} required />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Phone</label>
                    <input className="form-control" value={editPhone} onChange={(e) => setEditPhone(e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label>Batch</label>
                    <input className="form-control" value={editBatch} onChange={(e) => setEditBatch(e.target.value)} list="batch-list" placeholder="Select or type batch..." />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Password <small style={{ color: 'var(--text-muted)' }}>(leave blank to keep unchanged)</small></label>
                    <input
                      className="form-control"
                      type="password"
                      placeholder="Enter new password…"
                      value={editPassword}
                      onChange={(e) => setEditPassword(e.target.value)}
                      autoComplete="new-password"
                    />
                  </div>
                </div>

                {editAlert && (
                  <div className={`alert alert-${editAlert.type}`} style={{ marginBottom: '1rem' }}>
                    ⚠️ {editAlert.text}
                  </div>
                )}

                <div className="modal-footer" style={{ padding: 0, marginTop: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <button className="btn btn-danger btn-sm" type="button" onClick={() => {
                    handleDeleteStudentClick(modalStudent.id);
                    setActiveModal(null);
                  }}>🗑️ Delete Student</button>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button className="btn btn-outline" type="button" onClick={() => setActiveModal(null)}>Cancel</button>
                    <button className="btn btn-primary" type="submit" disabled={editLoading}>
                      {editLoading ? 'Saving...' : 'Save Changes'}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ── Account Statement Modal ── */}
      {activeModal === 'account-statement-modal' && modalStudent && (
        <div className="modal-overlay open" onClick={() => setActiveModal(null)}>
          <div className="modal" style={{ maxWidth: '650px', width: '90%' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">📄 Account Statement</div>
              <button className="modal-close" onClick={() => setActiveModal(null)}>✕</button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem' }}>
                <div>
                  <h3 style={{ margin: '0 0 0.2rem 0', fontSize: '1.15rem' }}>{modalStudent.name}</h3>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    {[modalStudent.studentId, modalStudent.batch, modalStudent.course].filter(Boolean).join(' · ')}
                  </span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '0.15rem' }}>Current Balance</div>
                  <div style={{ fontSize: '1.15rem', fontWeight: 700, color: (modalStudent.account_balance ?? 0) > 0 ? '#f87171' : (modalStudent.account_balance ?? 0) < 0 ? '#34d399' : 'var(--text-muted)' }}>
                    {(modalStudent.account_balance ?? 0) > 0 ? `Due: ${fmt(modalStudent.account_balance)}` : (modalStudent.account_balance ?? 0) < 0 ? `Advance: ${fmt(Math.abs(modalStudent.account_balance))}` : 'Cleared'}
                  </div>
                </div>
              </div>

              <div style={{ maxHeight: '300px', overflowY: 'auto', border: '1px solid var(--border)', borderRadius: '8px' }}>
                {/* Desktop View Table */}
                <table className="desktop-only" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--border)', background: 'rgba(255,255,255,0.02)', position: 'sticky', top: 0 }}>
                      <th style={{ padding: '0.65rem 0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Date</th>
                      <th style={{ padding: '0.65rem 0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Description</th>
                      <th style={{ padding: '0.65rem 0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Type</th>
                      <th style={{ padding: '0.65rem 0.75rem', color: 'var(--text-muted)', fontWeight: 600, textAlign: 'right' }}>Amount</th>
                      <th style={{ padding: '0.65rem 0.75rem', color: 'var(--text-muted)', fontWeight: 600, textAlign: 'right' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {asTransactions.length > 0 ? (
                      asTransactions.map((t) => {
                        const isCredit = t.type === 'credit';
                        const color = isCredit ? '#34d399' : '#f87171';
                        const dateStr = t.createdAt ? t.createdAt.split('T')[0] : '—';
                        const dateParts = dateStr.split('-');
                        const formattedDate = dateParts.length === 3 ? `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}` : dateStr;

                        return (
                          <tr key={t.id} style={{ borderBottom: '1px solid var(--border)' }}>
                            <td style={{ padding: '0.65rem 0.75rem', color: 'var(--text-muted)' }}>{formattedDate}</td>
                            <td style={{ padding: '0.65rem 0.75rem', fontWeight: 500 }}>{t.description || (isCredit ? 'Credit payment' : 'Debit charge')}</td>
                            <td style={{ padding: '0.65rem 0.75rem' }}><span style={{ color, fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase' }}>{isCredit ? 'Credit' : 'Debit'}</span></td>
                            <td style={{ padding: '0.65rem 0.75rem', textAlign: 'right', fontWeight: 700, color }}>{isCredit ? '+' : '-'}{fmt(t.amount)}</td>
                            <td style={{ padding: '0.65rem 0.75rem', textAlign: 'right' }}>
                              <button className="quick-btn qb-del" onClick={() => handleReverseDebitFromStatement(t.id)} title="Delete &amp; Reverse">🗑️</button>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan="5" style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>No transactions found.</td>
                      </tr>
                    )}
                  </tbody>
                </table>

                {/* Mobile View Card List */}
                <div className="mobile-only">
                  {asTransactions.length > 0 ? (
                    <div className="statement-card-list">
                      {asTransactions.map((t) => {
                        const isCredit = t.type === 'credit';
                        const color = isCredit ? '#34d399' : '#f87171';
                        const dateStr = t.createdAt ? t.createdAt.split('T')[0] : '—';
                        const dateParts = dateStr.split('-');
                        const formattedDate = dateParts.length === 3 ? `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}` : dateStr;

                        return (
                          <div key={t.id} className="statement-card">
                            <div className="statement-card-header">
                              <span className="statement-card-student" style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{formattedDate}</span>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <span style={{ color, fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase' }}>{isCredit ? 'Credit' : 'Debit'}</span>
                                <button className="quick-btn qb-del" onClick={() => handleReverseDebitFromStatement(t.id)} title="Delete &amp; Reverse">🗑️</button>
                              </div>
                            </div>
                            <div className="statement-card-body">
                              <span className="statement-card-desc">{t.description || (isCredit ? 'Credit payment' : 'Debit charge')}</span>
                              <span className="statement-card-amount" style={{ color }}>{isCredit ? '+' : '-'}{fmt(t.amount)}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                      No transactions found.
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="modal-footer" style={{ padding: 0, marginTop: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                {(modalStudent.account_balance ?? 0) > 0 && (
                  <button className="quick-btn qb-whatsapp" onClick={() => sendWhatsAppReminder(modalStudent.name, modalStudent.account_balance, modalStudent.phone)}>💬 Send Reminder</button>
                )}
              </div>
              <button className="btn btn-outline" onClick={() => setActiveModal(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Revenue Entry Detail Modal ── */}
      {activeModal === 'revenue-detail-modal' && modalRevenueEntry && (
        <div className="modal-overlay open" onClick={() => setActiveModal(null)}>
          <div className="modal" style={{ maxWidth: '480px', width: '95%' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">📝 Revenue Entry</div>
              <button className="modal-close" onClick={() => setActiveModal(null)}>✕</button>
            </div>
            <div className="modal-body">
              <form onSubmit={handleEditRevenueSubmit}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', padding: '0.5rem 0.75rem', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Source: <strong style={{ color: 'var(--accent-2)', marginLeft: '4px' }}>{modalRevenueEntry.source || 'Direct'}</strong>
                </div>

                <div className="form-group">
                  <label>Title *</label>
                  <input className="form-control" value={revDetailTitle} onChange={(e) => setRevDetailTitle(e.target.value)} required placeholder="e.g. A4 Paper" />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Amount (₹) *</label>
                    <input className="form-control" type="number" value={revDetailAmount} onChange={(e) => setRevDetailAmount(e.target.value)} required min="1" placeholder="0" />
                  </div>
                  <div className="form-group">
                    <label>Date</label>
                    <input className="form-control" type="date" value={revDetailDate} onChange={(e) => setRevDetailDate(e.target.value)} />
                  </div>
                </div>
                <div className="form-group">
                  <label>Notes</label>
                  <textarea className="form-control" value={revDetailNotes} onChange={(e) => setRevDetailNotes(e.target.value)} rows="2" placeholder="Optional notes…" />
                </div>

                {revDetailAlert && (
                  <div className={`alert alert-${revDetailAlert.type}`} style={{ marginBottom: '1rem' }}>
                    ⚠️ {revDetailAlert.text}
                  </div>
                )}

                <div className="modal-footer" style={{ padding: 0, marginTop: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <button className="btn btn-danger btn-sm" type="button" onClick={handleDeleteRevenueEntry}>🗑️ Delete</button>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button className="btn btn-outline" type="button" onClick={() => setActiveModal(null)}>Cancel</button>
                    <button className="btn btn-primary" type="submit" disabled={revDetailLoading}>
                      {revDetailLoading ? 'Saving...' : '💾 Save Changes'}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ── Daily Statement Modal ── */}
      {activeModal === 'dailyStatementModal' && (
        <div className="modal-overlay open" onClick={() => setActiveModal(null)}>
          <div className="modal" style={{ maxWidth: '650px', width: '90%' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">📋 Daily Print Revenue Statement</div>
              <button className="modal-close" onClick={() => setActiveModal(null)}>✕</button>
            </div>
            <div className="modal-body">
              <div style={{ marginBottom: '1.25rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem' }}>
                <h3 style={{ margin: 0, fontSize: '1.15rem' }}>
                  Statement for {dailyStatementDate.split('-').reverse().join('/')}
                </h3>
              </div>

              <div style={{ maxHeight: '300px', overflowY: 'auto', border: '1px solid var(--border)', borderRadius: '8px' }}>
                {/* Desktop View Table */}
                <table className="desktop-only" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--border)', background: 'rgba(255,255,255,0.02)', position: 'sticky', top: 0 }}>
                      <th style={{ padding: '0.65rem 0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Student Name</th>
                      <th style={{ padding: '0.65rem 0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Description</th>
                      <th style={{ padding: '0.65rem 0.75rem', color: 'var(--text-muted)', fontWeight: 600, textAlign: 'right' }}>Amount</th>
                      <th style={{ padding: '0.65rem 0.75rem', color: 'var(--text-muted)', fontWeight: 600, textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dailyStatementEntries.length > 0 ? (
                      dailyStatementEntries.map((item) => {
                        const matchName = item.title.split(' — ');
                        const studentName = matchName.length > 1 ? matchName[matchName.length - 1].trim() : 'General / Admin';
                        const description = matchName[0].trim();

                        return (
                          <tr key={item.id} style={{ borderBottom: '1px solid var(--border)' }}>
                            <td style={{ padding: '0.65rem 0.75rem', fontWeight: 600 }}>{studentName}</td>
                            <td style={{ padding: '0.65rem 0.75rem', color: 'var(--text-muted)' }}>{description}</td>
                            <td style={{ padding: '0.65rem 0.75rem', textAlign: 'right', fontWeight: 700, color: '#34d399' }}>+{fmt(item.amount)}</td>
                            <td style={{ padding: '0.65rem 0.75rem', textAlign: 'right' }}>
                              <button className="quick-btn qb-del" onClick={() => handleDeleteDailyRevenueEntry(item.id)} title="Delete &amp; Reverse">🗑️</button>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan="4" style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>No print revenue entries found for this date.</td>
                      </tr>
                    )}
                  </tbody>
                </table>

                {/* Mobile View Card List */}
                <div className="mobile-only">
                  {dailyStatementEntries.length > 0 ? (
                    <div className="statement-card-list">
                      {dailyStatementEntries.map((item) => {
                        const matchName = item.title.split(' — ');
                        const studentName = matchName.length > 1 ? matchName[matchName.length - 1].trim() : 'General / Admin';
                        const description = matchName[0].trim();

                        return (
                          <div key={item.id} className="statement-card">
                            <div className="statement-card-header">
                              <span className="statement-card-student">{studentName}</span>
                              <button className="quick-btn qb-del" onClick={() => handleDeleteDailyRevenueEntry(item.id)} title="Delete &amp; Reverse">🗑️</button>
                            </div>
                            <div className="statement-card-body">
                              <span className="statement-card-desc">{description}</span>
                              <span className="statement-card-amount">+{fmt(item.amount)}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                      No print revenue entries found for this date.
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="modal-footer" style={{ padding: 0, marginTop: '1rem' }}>
              <button className="btn btn-outline" onClick={() => setActiveModal(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Datalist batch options */}
      <datalist id="batch-list">
        <option value="HS1"></option>
        <option value="HS2"></option>
        <option value="BS1"></option>
        <option value="BS2"></option>
        <option value="BS3"></option>
        <option value="BS4"></option>
        <option value="BS5"></option>
      </datalist>

      {/* ── Custom Confirmation Modal ── */}
      {confirmOpen && (
        <div className="modal-overlay open" style={{ zIndex: 9999 }} onClick={() => setConfirmOpen(false)}>
          <div className="modal" style={{ maxWidth: '400px', width: '95%' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header" style={{ borderBottomColor: 'rgba(239, 68, 68, 0.15)' }}>
              <div className="modal-title" style={{ color: '#ef4444', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span>⚠️</span> {confirmTitle}
              </div>
              <button className="modal-close" onClick={() => setConfirmOpen(false)}>✕</button>
            </div>
            <div className="modal-body" style={{ padding: '1.5rem' }}>
              <p style={{ margin: 0, fontSize: '0.9rem', lineHeight: 1.5, color: '#94a3b8' }}>
                {confirmMessage}
              </p>
            </div>
            <div className="modal-footer" style={{ borderTopColor: 'rgba(255, 255, 255, 0.05)' }}>
              <button className="btn btn-outline" onClick={() => setConfirmOpen(false)}>Cancel</button>
              <button className="btn btn-danger" onClick={() => {
                if (confirmAction) confirmAction();
                setConfirmOpen(false);
              }}>{confirmBtnText}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
