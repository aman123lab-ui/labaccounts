import {
  getCurrentUser, logoutUser,
  getStudents, createStudent, updateStudent, deleteStudent, bulkCreateStudents,
  getExpenses, addExpense, deleteExpense,
  getRevenue, addRevenue, deleteRevenue,
  getDebits, addDebit, updateDebitStatus, deleteDebit, reverseAndDeleteEntry,
  applyStudentDebit, applyStudentCredit,
  getFinancialSummary, resetAllFinancialData
} from './storage.service.js';

// ── Button Loading Helper ──────────────────────────────
function setBtnLoading(btn, isLoading) {
  if (!btn) return;
  if (isLoading) {
    btn.disabled = true;
    btn.dataset.originalText = btn.innerHTML;
    btn.innerHTML = `<span class="spinner-inline"></span> Processing...`;
  } else {
    btn.disabled = false;
    if (btn.dataset.originalText) {
      btn.innerHTML = btn.dataset.originalText;
    }
  }
}

// ── Auth Guard ──────────────────────────────────────────
const user = getCurrentUser();
if (!user || user.role !== 'admin') window.location.href = '/login';
else {
  document.getElementById('sidebar-name').textContent = user.name;
  document.getElementById('sidebar-avatar').textContent = user.name[0].toUpperCase();
}

window.handleLogout = function () {
  logoutUser();
  window.location.href = '/login';
};

// ── Navigation ──────────────────────────────────────────
const titles = {
  dashboard: ['Dashboard', 'Overview of lab finances'],
  students: ['All Students', 'Manage student records'],
  register: ['Register Student', 'Add a new student'],
  bulk: ['Bulk Register', 'Import multiple students via CSV'],
  revenue: ['Revenue', 'Track incoming funds'],
  expenses: ['Expenses', 'Track outgoing funds'],
  debits: ['Debit Book', 'Student debits and dues'],
  reports: ['Reports', 'Financial summaries and exports'],
};

window.navigate = function (section) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById(`section-${section}`).classList.add('active');
  document.querySelector(`[data-section="${section}"]`).classList.add('active');
  const [title, sub] = titles[section] || ['', ''];
  document.getElementById('topbar-title').textContent = title;
  document.getElementById('topbar-subtitle').textContent = sub;
  loadSection(section);
};

window.loadSection = async function (section) {
  const active = section || document.querySelector('.nav-item.active')?.dataset.section || 'dashboard';
  if (active === 'dashboard') await loadDashboard();
  else if (active === 'students') await loadStudents();
  else if (active === 'revenue') await loadRevenue();
  else if (active === 'expenses') await loadExpenses();
  else if (active === 'debits') await loadDebits();
  else if (active === 'reports') await loadReports();
};

// ── Toast ───────────────────────────────────────────────
function toast(msg, type = 'info') {
  const icons = { success: '✅', error: '❌', info: 'ℹ️' };
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.textContent = `${icons[type]} ${msg}`;
  document.getElementById('toast-container').appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

// ── Modal Helpers ───────────────────────────────────────
window.closeModal = function (id) {
  document.getElementById(id).classList.remove('open');
};
function openModal(id) {
  document.getElementById(id).classList.add('open');
}

// ── Format ──────────────────────────────────────────────
const fmt = n => '₹' + Number(n || 0).toLocaleString('en-IN');
const fmtDate = d => d ? new Date(d).toLocaleDateString('en-IN') : '—';

// ── Dashboard ───────────────────────────────────────────
async function loadDashboard() {
  const { data: summary } = await getFinancialSummary();
  
  const cashInHandEl = document.getElementById('s-cash-in-hand');
  if (cashInHandEl) {
    cashInHandEl.textContent = fmt(summary.cashInHand);
    cashInHandEl.className = `stat-value ${summary.cashInHand < 0 ? 'text-danger' : 'text-success'}`;
  }

  const expensesEl = document.getElementById('s-expenses');
  if (expensesEl) {
    expensesEl.textContent = fmt(summary.totalExpenses);
  }

  const pendingDebitorsEl = document.getElementById('s-pending-debtors');
  if (pendingDebitorsEl) {
    pendingDebitorsEl.textContent = fmt(summary.pendingDebits);
  }

  const netWorthEl = document.getElementById('s-net-worth');
  if (netWorthEl) {
    netWorthEl.textContent = fmt(summary.netWorth);
    netWorthEl.className = `stat-value ${summary.netWorth < 0 ? 'text-danger' : 'text-success'}`;
  }

  const { data: rev } = await getRevenue();
  const { data: exp } = await getExpenses();

  // Revenue list – show the 5 most recent dates
  const revByDate = groupRevenueByDate(rev);
  const recentDates = Object.keys(revByDate)
    .sort((a, b) => b.localeCompare(a))
    .slice(0, 5);

  const revList = document.getElementById('recent-revenue-list');
  revList.innerHTML = recentDates.length
    ? recentDates
      .map(date => {
        const amount = fmt(revByDate[date]);
        const formattedDate = fmtDate(date);
        return (
          '<div style="display:flex;justify-content:space-between;align-items:center;padding:.55rem 0;border-bottom:1px solid var(--border);font-size:.85rem">' +
          `<span><strong>${formattedDate}</strong> <span class="badge badge-success" style="margin-left:.5rem">Cash Revenue</span></span>` +
          `<strong class="text-success">${amount}</strong>` +
          '</div>'
        );
      })
      .join('')
    : '<div class="text-muted" style="font-size:.85rem">No cash revenue entries yet.</div>';

  // Expense list – latest 5 entries
  const expList = document.getElementById('recent-expense-list');
  const recent5exp = exp.slice(-5).reverse();
  expList.innerHTML = recent5exp.length
    ? recent5exp
      .map(e => {
        const title = e.title || '—';
        const category = e.category || '—';
        const amount = fmt(e.amount);
        return (
          '<div style="display:flex;justify-content:space-between;padding:.5rem 0;border-bottom:1px solid var(--border);font-size:.85rem">' +
          `<span>${title} <span class="badge badge-danger" style="margin-left:.4rem">${category}</span></span>` +
          `<strong class="text-danger">${amount}</strong>` +
          '</div>'
        );
      })
      .join('')
    : '<div class="text-muted" style="font-size:.85rem">No expense entries yet.</div>';
}

// ── Students ────────────────────────────────────────────
let allStudents = [];

async function loadStudents() {
  const { data } = await getStudents();
  allStudents = data || [];

  // Populate dynamic batch filter options
  const filterSelect = document.getElementById('student-batch-filter');
  if (filterSelect) {
    const previousVal = filterSelect.value;
    const batches = [...new Set(allStudents.map(s => s.batch).filter(Boolean))].sort();

    let optionsHtml = '<option value="all">All Batches</option>';
    batches.forEach(b => {
      optionsHtml += `<option value="${b}">${b}</option>`;
    });
    filterSelect.innerHTML = optionsHtml;

    if (batches.includes(previousVal)) {
      filterSelect.value = previousVal;
    } else {
      filterSelect.value = 'all';
    }
  }

  filterStudents();
}

function renderStudents(data) {
  const tbody = document.getElementById('students-tbody');
  if (!data.length) {
    tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state"><div class="empty-icon">🎓</div>No students registered yet.</div></td></tr>`;
    return;
  }

  // Retrieve user credentials from the lab_users database table in localStorage
  let users = [];
  try {
    users = JSON.parse(localStorage.getItem('lab_users')) ?? [];
  } catch (_) {}

  tbody.innerHTML = data.map(s => {
    // account_balance: positive = owes money (red), negative = advance/credit (green), 0 = cleared (muted)
    const bal = s.account_balance ?? 0;
    const balColor = bal > 0 ? 'color:#f87171' : bal < 0 ? 'color:#34d399' : 'color:var(--text-muted)';
    const balLabel = bal > 0 ? `Due: ${fmt(Math.abs(bal))}` : bal < 0 ? `Adv: ${fmt(Math.abs(bal))}` : 'Cleared';
    
    // Find the associated user credentials to extract the password
    const user = users.find(u => u.id === s.userId);
    const pwd = user ? user.password : '—';

    return `<tr>
      <td><span class="badge badge-purple">${s.studentId}</span></td>
      <td><strong>${s.name}</strong></td>
      <td>${s.batch || '<span style="color:var(--text-muted)">—</span>'}</td>
      <td><code style="color:var(--accent-2); font-weight:600">${pwd}</code></td>
      <td style="font-weight:700;${balColor}">${balLabel}</td>
      <td style="text-align:right; white-space:nowrap;">
        <button class="quick-btn qb-edit" onclick="openEditStudent('${s.id}')" title="Edit Student" style="margin-right: 4px;">✏️</button>
        <button class="quick-btn qb-del" onclick="handleDeleteStudent('${s.id}')" title="Delete Student">🗑️</button>
      </td>
    </tr>`;
  }).join('');
}

window.filterStudents = function () {
  const q = document.getElementById('student-search').value.toLowerCase();
  const batchVal = document.getElementById('student-batch-filter')?.value || 'all';

  let filtered = allStudents;

  if (batchVal !== 'all') {
    filtered = filtered.filter(s => (s.batch || '').toLowerCase() === batchVal.toLowerCase());
  }

  if (q) {
    filtered = filtered.filter(s =>
      s.name.toLowerCase().includes(q) ||
      s.studentId.toLowerCase().includes(q) ||
      (s.course || '').toLowerCase().includes(q) ||
      (s.department || '').toLowerCase().includes(q)
    );
  }

  renderStudents(filtered);
};

window.handleDeleteStudent = async function (id) {
  if (!confirm('Delete this student? This cannot be undone.')) return;
  const { error } = await deleteStudent(id);
  if (error) return toast(error, 'error');
  toast('Student deleted.', 'success');
  await loadStudents();
  await loadDebits();
};

window.openEditStudent = async function (id) {
  const { getStudentById } = await import('./storage.service.js');
  const { data } = await getStudentById(id);
  if (!data) return toast('Student not found.', 'error');
  const form = document.getElementById('edit-student-form');
  ['id', 'name', 'studentId', 'email', 'phone', 'course', 'department', 'totalFee', 'paidAmount', 'batch'].forEach(k => {
    if (form[k]) form[k].value = data[k] || '';
  });
  openModal('edit-student-modal');
};

window.handleEditStudent = async function (e) {
  e.preventDefault();
  const form = e.target;
  const btn = form.querySelector('button[type="submit"]');
  setBtnLoading(btn, true);
  const data = Object.fromEntries(new FormData(form));

  // Extract and remove password from the student-record update payload
  const newPassword = (data.password || '').trim();
  delete data.password;

  const { error } = await updateStudent(data.id, data);
  if (error) { 
    toast(error, 'error'); 
    setBtnLoading(btn, false);
    return; 
  }

  // If a new password was entered, update the linked user account
  if (newPassword) {
    const { getStudentById, updateUserPassword } = await import('./storage.service.js');
    const { data: studentRecord } = await getStudentById(data.id);
    if (studentRecord?.userId) {
      await updateUserPassword(studentRecord.userId, newPassword);
    }
  }

  toast('Student updated.' + (newPassword ? ' Password changed.' : ''), 'success');
  closeModal('edit-student-modal');
  setBtnLoading(btn, false);
  await loadStudents();
};


window.toTitleCase = function (str) {
  if (!str) return '';
  return str.split(' ').map(word => {
    if (!word) return '';
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  }).join(' ');
}

// ── Register ─────────────────────────────────────────────
window.handleRegister = async function (e) {
  e.preventDefault();
  const form = e.target;
  const btn = form.querySelector('button[type="submit"]');
  setBtnLoading(btn, true);

  const rawName = form.querySelector('[name="name"]').value.trim();
  const name = toTitleCase(rawName);
  const studentId = form.querySelector('[name="studentId"]').value.trim();
  const batch = form.querySelector('[name="batch"]').value.trim();
  const phone = form.querySelector('[name="phone"]').value.trim();
  const password = form.querySelector('[name="password"]').value;

  const alertEl = document.getElementById('reg-alert');
  alertEl.innerHTML = '';

  const studentData = {
    name,
    studentId,
    phone,
    password,
    batch,
    email: '',
    course: '',
    department: '',
    semester: '',
    totalFee: 0,
    paidAmount: 0,
    account_balance: 0
  };

  const { data: student, error } = await createStudent(studentData);
  if (error) {
    alertEl.innerHTML = `<div class="alert alert-error">⚠️ ${error}</div>`;
    setBtnLoading(btn, false);
    return;
  }

  alertEl.innerHTML = `<div class="alert alert-success">✅ Student "${student.name}" registered! Login: <strong>${studentId}</strong></div>`;
  form.reset();
  toast('Student registered successfully!', 'success');
  setBtnLoading(btn, false);
  await loadStudents();
};

// ── Bulk Register ────────────────────────────────────────
window.downloadCSVTemplate = function () {
  const csv = 'name,studentId,batch,phone,password,openingBalance\nJohn Doe,STU-001,Batch A,9876543210,pass123,150\nJane Smith,STU-002,Batch B,9123456780,pass456,0';
  const a = document.createElement('a');
  a.href = 'data:text/csv,' + encodeURIComponent(csv);
  a.download = 'student_template.csv';
  a.click();
};

window.handleCSVUpload = function (e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => { document.getElementById('bulk-text').value = ev.target.result; };
  reader.readAsText(file);
};

window.handleBulkRegister = async function (e) {
  if (e) e.preventDefault();
  const raw = document.getElementById('bulk-text').value.trim();
  const alertEl = document.getElementById('bulk-alert');
  if (!raw) { alertEl.innerHTML = `<div class="alert alert-error">⚠️ No data to import.</div>`; return; }

  const btn = e ? e.currentTarget || e.target : document.querySelector('#section-bulk button.btn-primary');
  setBtnLoading(btn, true);

  const lines = raw.split('\n').filter(l => l.trim());
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase());

  if (!headers.includes('name') || !headers.includes('studentid')) {
    alertEl.innerHTML = `<div class="alert alert-error">⚠️ CSV must contain at least "name" and "studentId" headers.</div>`;
    setBtnLoading(btn, false);
    return;
  }

  // ── Parse rows ────────────────────────────────────────────
  const rows = lines.slice(1).map(line => {
    const vals = line.split(',').map(v => v.trim());
    const rowObj = Object.fromEntries(headers.map((h, i) => [h, vals[i] || '']));

    // Parse opening balance — column 6 (index 5), default 0
    const openingBalance = Math.max(0, parseFloat(rowObj.openingbalance) || 0);

    return {
      name: rowObj.name || '',
      studentId: rowObj.studentid || '',
      phone: rowObj.phone || '',
      password: rowObj.password || (rowObj.studentid ? rowObj.studentid + '123' : 'pass123'),
      batch: rowObj.batch || '',
      email: '',
      course: '',
      department: '',
      semester: '',
      totalFee: 0,
      paidAmount: 0,
      account_balance: openingBalance,        // ← set opening balance on student record
      _openingBalance: openingBalance,        // ← keep a copy for ledger generation below
    };
  }).filter(r => r.name && r.studentId);

  if (!rows.length) {
    alertEl.innerHTML = `<div class="alert alert-error">⚠️ No valid student entries found to import.</div>`;
    setBtnLoading(btn, false);
    return;
  }

  // ── Create students ───────────────────────────────────────
  const results = await bulkCreateStudents(rows);

  // Since createStudent handles the opening balance recording automatically on Supabase,
  // we just calculate the number of students with opening balances for reporting.
  let ledgerWritten = 0;
  for (const created of results.created) {
    const inputRow = rows.find(r => r.studentId === created.studentId);
    const ob = inputRow?._openingBalance || 0;
    if (ob > 0) ledgerWritten++;
  }

  // ── Show result ───────────────────────────────────────────
  const obNote = ledgerWritten > 0 ? ` (${ledgerWritten} opening balance${ledgerWritten > 1 ? 's' : ''} recorded)` : '';
  alertEl.innerHTML = `<div class="alert alert-success">✅ Imported ${results.created.length} students${obNote}. ${results.errors.length ? `❌ ${results.errors.length} failed: ${results.errors.map(e => e.student.studentId + ': ' + e.error).join(', ')}` : ''}</div>`;

  if (results.created.length) {
    toast(`${results.created.length} students imported!`, 'success');
    await loadStudents();
    await loadDebits();
  }
  setBtnLoading(btn, false);
};

// ── Revenue ──────────────────────────────────────────────
// Helper: group CASH-BASIS revenue rows by date → { 'YYYY-MM-DD': total, … }
// Strict whitelist — only 'Direct Cash' and 'Fee Payment' represent actual money received.
// 'Manual Credit' (student debt) and 'Student Debit' (print charges) are excluded.
const _CASH_SOURCES = new Set(['direct cash', 'fee payment']);
function groupRevenueByDate(data) {
  return data
    .filter(r => _CASH_SOURCES.has((r.source || '').toLowerCase()))
    .reduce((acc, r) => {
      const d = r.date || (r.createdAt ? r.createdAt.split('T')[0] : new Date().toISOString().split('T')[0]);
      acc[d] = (acc[d] || 0) + parseFloat(r.amount || 0);
      return acc;
    }, {});
}

// Helper: group an array of revenue rows by date + title
function groupRevenueByDateAndTitle(data) {
  return data.reduce((acc, r) => {
    const d = r.date || (r.createdAt ? r.createdAt.split('T')[0] : new Date().toISOString().split('T')[0]);
    // Only apply Daily Print Revenue grouping if it actually came from print debit modal
    const isPrint = (r.description === 'Print' || r.source === 'Student Debit') && r.source !== 'Manual Credit';
    const groupedTitle = isPrint ? 'Daily Print Revenue' : (r.title || 'General Revenue');

    // Group prints by date; keep manual entries completely individual
    const key = isPrint ? (d + '|' + groupedTitle) : (d + '|' + r.id + '|' + groupedTitle);
    if (!acc[key]) {
      acc[key] = {
        date: d,
        title: groupedTitle,
        amount: 0,
        isPrint: isPrint,
        source: isPrint ? 'Print' : (r.source || 'Direct'),
        id: isPrint ? null : r.id,   // store raw id for non-print entries
        notes: isPrint ? '' : (r.notes || '')
      };
    }
    acc[key].amount += parseFloat(r.amount || 0);
    return acc;
  }, {});
}

window.toggleRevenueType = function () {
  const typeSelect = document.getElementById('revType');
  const studentGroup = document.getElementById('revStudentGroup');
  const studentSelect = document.getElementById('revStudentId');
  if (!typeSelect || !studentGroup || !studentSelect) return;

  if (typeSelect.value === 'Credit') {
    studentGroup.style.display = 'block';
    studentSelect.required = true;
  } else {
    studentGroup.style.display = 'none';
    studentSelect.required = false;
    studentSelect.value = '';
  }
};

window.populateRevenueStudents = async function () {
  const selectEl = document.getElementById('revStudentId');
  if (!selectEl) return;

  if (!selectEl.dataset.listenerAttached) {
    selectEl.addEventListener('change', function () {
      if (this.value === 'register_new') {
        window.location.href = 'register.html';
      }
    });
    selectEl.dataset.listenerAttached = 'true';
  }

  const { data: students } = await getStudents();
  const sorted = [...students].sort((a, b) => a.name.localeCompare(b.name));
  selectEl.innerHTML = '<option value="" disabled selected>Select registered student...</option>' +
    '<option value="register_new">+ Student Registration</option>' +
    sorted.map(s => `<option value="${s.id}">${s.name} (${s.batch || '—'})</option>`).join('');
};

async function loadRevenue() {
  const { data } = await getRevenue();
  const total = data.reduce((s, r) => s + r.amount, 0);
  document.getElementById('total-revenue-badge').textContent = `Total: ${fmt(total)}`;

  await populateRevenueStudents();

  // Auto-fill today's date if empty
  const dateInput = document.querySelector('#revenue-form [name="date"]');
  if (dateInput && !dateInput.value) {
    dateInput.value = new Date().toISOString().split('T')[0];
  }

  // Group by composite key (date + title) and sort newest first
  const grouped = groupRevenueByDateAndTitle(data);
  const sortedRows = Object.values(grouped).sort((a, b) => {
    if (a.date !== b.date) {
      return b.date.localeCompare(a.date);
    }
    return a.title.localeCompare(b.title);
  });

  const tbody = document.getElementById('revenue-tbody');

  tbody.innerHTML = sortedRows.length
    ? sortedRows.map(t => {
      const titleHtml = t.isPrint
        ? `<a href="#" onclick="event.preventDefault(); openDailyStatement('${t.date}')" style="color: var(--accent-2); cursor: pointer; text-decoration: none;">Daily Print Revenue</a>`
        : `<a href="#" onclick="event.preventDefault(); openRevenueDetail('${t.id}')" style="color: var(--text-primary); cursor: pointer; text-decoration: none; font-weight:600;" onmouseover="this.style.color='var(--accent-2)'" onmouseout="this.style.color='var(--text-primary)'">${t.title}</a>`;
      const sourceHtml = t.isPrint
        ? `<span class="badge badge-success">Print</span>`
        : `<span class="badge badge-info">${t.source}</span>`;
      return `<tr>
          <td><strong>${titleHtml}</strong></td>
          <td>${sourceHtml}</td>
          <td class="text-success fw-bold" style="text-align:right">${fmt(t.amount)}</td>
          <td class="td-muted">${fmtDate(t.date)}</td>
        </tr>`;
    }).join('')
    : `<tr><td colspan="4"><div class="empty-state"><div class="empty-icon">💰</div>No revenue entries yet.</div></td></tr>`;
}

// ── Revenue Entry Detail Modal ─────────────────────────────
window.openRevenueDetail = async function (id) {
  if (!id) return;
  const { data: allRevenue } = await getRevenue();
  const entry = allRevenue.find(r => r.id === id);
  if (!entry) { toast('Revenue entry not found.', 'error'); return; }

  // Populate modal fields
  document.getElementById('rev-detail-id').value = entry.id;
  document.getElementById('rev-detail-title').value = entry.title || '';
  document.getElementById('rev-detail-amount').value = entry.amount || '';
  document.getElementById('rev-detail-date').value = entry.date || '';
  document.getElementById('rev-detail-notes').value = entry.notes || '';
  document.getElementById('rev-detail-source').textContent = entry.source || 'Direct';
  document.getElementById('rev-detail-alert').innerHTML = '';
  openModal('revenue-detail-modal');
};

window.handleEditRevenue = async function (e) {
  e.preventDefault();
  const alertEl = document.getElementById('rev-detail-alert');
  const btn = e.target.querySelector('button[type="submit"]');
  setBtnLoading(btn, true);
  const id = document.getElementById('rev-detail-id').value;
  const title = document.getElementById('rev-detail-title').value.trim();
  const amount = parseFloat(document.getElementById('rev-detail-amount').value);
  const date = document.getElementById('rev-detail-date').value;
  const notes = document.getElementById('rev-detail-notes').value.trim();

  if (!title) { 
    alertEl.innerHTML = `<div class="alert alert-error">⚠️ Title is required.</div>`; 
    setBtnLoading(btn, false);
    return; 
  }
  if (!amount || amount <= 0) { 
    alertEl.innerHTML = `<div class="alert alert-error">⚠️ Amount must be greater than zero.</div>`; 
    setBtnLoading(btn, false);
    return; 
  }

  const { updateRevenue } = await import('./storage.service.js');
  const { error } = await updateRevenue(id, { title, amount, date, notes });
  if (error) {
    alertEl.innerHTML = `<div class="alert alert-error">⚠️ ${error}</div>`;
    setBtnLoading(btn, false);
    return;
  }

  toast('Revenue entry updated!', 'success');
  closeModal('revenue-detail-modal');
  setBtnLoading(btn, false);
  await loadRevenue();
};

window.handleDeleteRevenueEntry = async function () {
  const id = document.getElementById('rev-detail-id').value;
  if (!id) return;
  if (!confirm('Delete this revenue entry? This cannot be undone.')) return;

  // Check if there is a linked debit entry — if so, reverse it properly
  const { data: debits } = await getDebits();
  const linkedDebit = debits.find(d => d.revenue_id === id);
  if (linkedDebit) {
    const { error } = await reverseAndDeleteEntry(linkedDebit.id);
    if (error) { toast(`Error: ${error}`, 'error'); return; }
  } else {
    await deleteRevenue(id);
  }

  toast('Revenue entry deleted.', 'success');
  closeModal('revenue-detail-modal');
  await loadRevenue();
};

window.openDailyStatement = async function (date) {

  const titleEl = document.getElementById('ds-date-title');
  if (titleEl) {
    const dateParts = date.split('-');
    const formattedDate = dateParts.length === 3 ? `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}` : date;
    titleEl.textContent = `Statement for ${formattedDate}`;
  }

  const { data: revenueEntries } = await getRevenue();
  const filtered = revenueEntries.filter(r => {
    const d = r.date || (r.createdAt ? r.createdAt.split('T')[0] : '');
    return d === date;
  });

  const tbody = document.getElementById('dailyStatementTableBody');
  if (!tbody) return;

  if (!filtered.length) {
    tbody.innerHTML = `<tr><td colspan="4" style="padding: 1.5rem; text-align: center; color: var(--text-muted);">No print revenue entries found for this date.</td></tr>`;
  } else {
    tbody.innerHTML = filtered.map(item => {
      const matchName = item.title.split(' — ');
      const studentName = matchName.length > 1 ? matchName[matchName.length - 1].trim() : 'General / Admin';
      const description = matchName[0].trim();

      return `<tr style="border-bottom: 1px solid var(--border);">
        <td style="padding: 0.65rem 0.75rem; font-weight: 600;">${studentName}</td>
        <td style="padding: 0.65rem 0.75rem; color: var(--text-muted);">${description}</td>
        <td style="padding: 0.65rem 0.75rem; text-align: right; font-weight: 700; color: #34d399;">+${fmt(item.amount)}</td>
        <td style="padding: 0.65rem 0.75rem; text-align: right;">
          <button class="quick-btn qb-del" onclick="deleteDailyRevenueEntry('${item.id}', '${date}')" title="Delete & Reverse">🗑️</button>
        </td>
      </tr>`;
    }).join('');
  }

  const modal = document.getElementById('dailyStatementModal');
  if (modal) {
    modal.classList.add('open');
    modal.style.display = 'block';
  }
};

window.closeDailyStatement = function () {
  const modal = document.getElementById('dailyStatementModal');
  if (modal) {
    modal.classList.remove('open');
    modal.style.display = 'none';
  }
};

window.deleteDailyRevenueEntry = async function (revenueId, date) {
  if (!confirm('Are you sure you want to delete this revenue entry? This will reverse any linked student charges/payments.')) return;

  const { data: debits } = await getDebits();
  const linkedDebit = debits.find(d => d.revenue_id === revenueId);

  if (linkedDebit) {
    const { error } = await reverseAndDeleteEntry(linkedDebit.id);
    if (error) {
      toast(`Error reversing entry: ${error}`, 'error');
      return;
    }
  } else {
    await deleteRevenue(revenueId);
  }

  toast('Revenue entry deleted successfully!', 'success');
  await openDailyStatement(date);
  await loadRevenue();

  if (document.getElementById('section-dashboard').classList.contains('active')) {
    await loadDashboard();
  }
};


window.handleAddRevenue = async function (e) {
  e.preventDefault();
  const form = e.target;
  const btn = form.querySelector('button[type="submit"]');
  setBtnLoading(btn, true);
  const data = Object.fromEntries(new FormData(form));
  const alertEl = document.getElementById('rev-alert');
  alertEl.innerHTML = '';

  // ── Validation ──────────────────────────────────────────
  const title = (data.title || '').trim();
  if (!title) {
    alertEl.innerHTML = `<div class="alert alert-error">⚠️ Title is required.</div>`;
    setBtnLoading(btn, false);
    return;
  }

  const amt = parseFloat(data.amount);
  if (!amt || amt <= 0) {
    alertEl.innerHTML = `<div class="alert alert-error">⚠️ Amount must be greater than zero.</div>`;
    setBtnLoading(btn, false);
    return;
  }

  const type = data.revType || 'Cash';
  const dateVal = data.date || new Date().toISOString().split('T')[0];
  const notes = (data.notes || '').trim();

  // ── CASH path ───────────────────────────────────────────
  // Saves a standalone revenue row. No student ledger is touched.
  if (type === 'Cash' || type === 'Opening Cash') {
    const { error } = await addRevenue({
      title,          // ← exact user input, no prefix
      amount: amt,
      date: dateVal,
      notes,
      source: type === 'Opening Cash' ? 'Opening Cash Balance' : 'Direct Cash',
      description: type === 'Opening Cash' ? 'Opening Cash' : 'Cash',   // used internally to distinguish from Print; never shown as prefix
    });
    if (error) {
      alertEl.innerHTML = `<div class="alert alert-error">⚠️ ${error}</div>`;
      setBtnLoading(btn, false);
      return;
    }

    // ── CREDIT path ─────────────────────────────────────────
    // Charges a student's account AND records revenue.
    // Title is ALWAYS exactly what the user typed — no 'Print:' prefix.
  } else {
    const studentId = data.revStudentId;
    if (!studentId) {
      alertEl.innerHTML = `<div class="alert alert-error">⚠️ Please select a student.</div>`;
      setBtnLoading(btn, false);
      return;
    }

    const { applyStudentManualDebit } = await import('./storage.service.js');
    const { error } = await applyStudentManualDebit(studentId, amt, title, dateVal, notes);
    if (error) {
      alertEl.innerHTML = `<div class="alert alert-error">⚠️ ${error}</div>`;
      setBtnLoading(btn, false);
      return;
    }
  }

  // ── Reset & refresh ─────────────────────────────────────
  form.reset();
  const dateInput = form.querySelector('[name="date"]');
  if (dateInput) {
    dateInput.value = new Date().toISOString().split('T')[0];
  }
  window.toggleRevenueType();
  alertEl.innerHTML = '';
  toast('Revenue recorded successfully!', 'success');
  setBtnLoading(btn, false);

  await loadRevenue();
  await loadDebits();

  if (document.getElementById('section-dashboard').classList.contains('active')) {
    await loadDashboard();
  }

};

window.handleDeleteRevenue = async function (id) {
  if (!confirm('Delete this revenue entry?')) return;
  await deleteRevenue(id);
  toast('Revenue deleted.', 'success');
  await loadRevenue();
};

// ── Expenses ─────────────────────────────────────────────
async function loadExpenses() {
  const { data } = await getExpenses();
  const total = data.reduce((s, e) => s + e.amount, 0);
  document.getElementById('total-expense-badge').textContent = `Total: ${fmt(total)}`;

  // Auto-fill today's date if empty
  const dateInput = document.getElementById('expense-date-input');
  if (dateInput && !dateInput.value) {
    dateInput.value = new Date().toISOString().split('T')[0];
  }

  const tbody = document.getElementById('expense-tbody');
  tbody.innerHTML = data.length ? [...data].reverse().map(e => `<tr>
    <td><strong>${e.title}</strong></td>
    <td class="text-danger fw-bold">${fmt(e.amount)}</td>
    <td class="td-muted">${fmtDate(e.date)}</td>
    <td class="td-muted">${e.notes || '—'}</td>
    <td><button class="btn btn-danger btn-sm" onclick="handleDeleteExpense('${e.id}')">🗑️</button></td>
  </tr>`).join('') : `<tr><td colspan="5"><div class="empty-state"><div class="empty-icon">💸</div>No expense entries yet.</div></td></tr>`;
}

window.handleAddExpense = async function (e) {
  e.preventDefault();
  const form = e.target;
  const btn = form.querySelector('button[type="submit"]');
  setBtnLoading(btn, true);
  const data = Object.fromEntries(new FormData(form));

  // Use entered date or fallback to auto-generated current date
  if (!data.date) {
    data.date = new Date().toISOString().split('T')[0];
  }

  const alertEl = document.getElementById('exp-alert');
  const { error } = await addExpense(data);
  if (error) { 
    alertEl.innerHTML = `<div class="alert alert-error">⚠️ ${error}</div>`; 
    setBtnLoading(btn, false);
    return; 
  }

  form.reset();

  // Reset date input to current date
  const dateInput = document.getElementById('expense-date-input');
  if (dateInput) {
    dateInput.value = new Date().toISOString().split('T')[0];
  }

  alertEl.innerHTML = '';
  toast('Expense added!', 'success');
  setBtnLoading(btn, false);
  await loadExpenses();
};

window.handleDeleteExpense = async function (id) {
  if (!confirm('Delete this expense entry?')) return;
  await deleteExpense(id);
  toast('Expense deleted.', 'success');
  await loadExpenses();
};

// ── Debtor Management ─────────────────────────────────────
let allDebits = [];
let allStudentsCache = [];   // for searchable dropdown & debtor list
let debtorListCache = [];    // for client-side filter

async function loadDebits() {
  const [{ data: debits }, { data: students }] = await Promise.all([
    getDebits(), getStudents()
  ]);
  allDebits = debits;
  allStudentsCache = students;
  renderDebitStats(debits, students);
  renderDebtorList(students, debits);
}

function renderDebitStats(data, students) {
  const netOutstanding = students
    .filter(s => (s.account_balance ?? 0) > 0)
    .reduce((s, st) => s + st.account_balance, 0);

  const debitsEl = document.getElementById('ds-debits');
  if (debitsEl) {
    const totalBilled = data.filter(d => d.type !== 'credit').reduce((s, d) => s + d.amount, 0);
    debitsEl.textContent = fmt(totalBilled);
  }

  const creditsEl = document.getElementById('ds-credits');
  if (creditsEl) {
    const totalCollected = data.filter(d => d.type === 'credit').reduce((s, d) => s + d.amount, 0);
    creditsEl.textContent = fmt(totalCollected);
  }

  const studentsEl = document.getElementById('ds-students');
  if (studentsEl) {
    const activeDebtors = students.filter(s =>
      (s.account_balance ?? 0) !== 0 || data.some(d => d.studentId === s.id)
    ).length;
    studentsEl.textContent = activeDebtors;
  }

  const pendingEl = document.getElementById('ds-pending');
  if (pendingEl) {
    pendingEl.textContent = fmt(netOutstanding);
    pendingEl.style.color = netOutstanding > 0 ? '#f87171' : netOutstanding < 0 ? '#34d399' : '';
  }
}

// ── Debtor List (primary view) ────────────────────────────
function renderDebtorList(students, debits) {
  const tbody = document.getElementById('debtor-tbody');
  if (!tbody) return;

  const relevant = students.filter(s =>
    (s.account_balance ?? 0) !== 0 || debits.some(d => d.studentId === s.id)
  );
  debtorListCache = relevant;

  if (!relevant.length) {
    tbody.innerHTML = `<tr><td colspan="4"><div class="empty-state">
      <div class="empty-icon">👥</div>
      No debit/credit activity yet. Use the FAB buttons or the full-search modals to get started.
    </div></td></tr>`;
    return;
  }

  tbody.innerHTML = relevant.map(s => {
    const balance = s.account_balance ?? 0;

    let pillClass, pillText;
    if (balance > 0) { pillClass = 'due'; pillText = `🔴 Due: ${fmt(balance)}`; }
    else if (balance < 0) { pillClass = 'advance'; pillText = `🟢 Advance: ${fmt(Math.abs(balance))}`; }
    else { pillClass = 'cleared'; pillText = `✅ Cleared`; }

    const isDue = balance > 0;
    const whatsappBtn = isDue
      ? `<button class="dropdown-item qb-whatsapp" onclick="sendWhatsAppReminder('${s.name.replace(/'/g, "\\'")}', ${balance}, '${s.phone || ''}')">💬 Remind</button>`
      : '';

    const actions = `
      <div class="action-dropdown-container">
        <button class="kebab-btn" onclick="toggleActionDropdown(event, '${s.id}')" title="Actions">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="1.5"></circle>
            <circle cx="12" cy="5" r="1.5"></circle>
            <circle cx="12" cy="19" r="1.5"></circle>
          </svg>
        </button>
        <div id="action-dropdown-${s.id}" class="action-dropdown-menu">
          <button class="dropdown-item qb-charge" onclick="openQuickCharge('${s.id}')">📤 Charge</button>
          <button class="dropdown-item qb-collect" onclick="openQuickCollect('${s.id}')">📥 Collect</button>
          ${whatsappBtn}
          <button class="dropdown-item qb-del" onclick="handleDeleteStudent('${s.id}')" style="color:var(--danger)">🗑️ Delete Account</button>
        </div>
      </div>
    `;

    return `<tr>
      <td>
        <div class="debtor-name debtor-name-clickable" onclick="openAccountStatement('${s.id}')">${s.name}</div>
        <div class="debtor-meta">${[s.course, s.department].filter(Boolean).join(' · ') || '—'}</div>
      </td>
      <td>
        <span class="badge badge-purple">${s.studentId}</span>
        ${s.batch ? `<div class="debtor-meta" style="margin-top:3px">${s.batch}</div>` : ''}
      </td>
      <td style="text-align:center"><span class="balance-pill ${pillClass}">${pillText}</span></td>
      <td style="text-align:center">${actions}</td>
    </tr>`;
  }).join('');
}

window.filterDebtors = function () {
  const q = document.getElementById('debtor-search')?.value.toLowerCase() || '';
  const filtered = debtorListCache.filter(s =>
    s.name.toLowerCase().includes(q) ||
    s.studentId.toLowerCase().includes(q) ||
    (s.batch || '').toLowerCase().includes(q)
  );
  renderDebtorList(filtered, allDebits);
};




window.openAccountStatement = async function (studentId) {
  // Fetch fresh students list and debits to ensure balance is perfectly synchronized
  const [{ data: students }, { data: debits }] = await Promise.all([
    getStudents(), getDebits()
  ]);

  if (students) allStudentsCache = students;
  if (debits) allDebits = debits;

  const s = allStudentsCache.find(st => st.id === studentId);
  if (!s) return;

  document.getElementById('as-student-name').textContent = s.name;
  document.getElementById('as-student-id').textContent =
    [s.studentId, s.batch, s.course].filter(Boolean).join(' · ');

  const bal = s.account_balance ?? 0;
  const balEl = document.getElementById('as-current-balance');
  balEl.textContent = bal > 0 ? `Due: ${fmt(bal)}` : bal < 0 ? `Advance: ${fmt(Math.abs(bal))}` : 'Cleared';
  balEl.style.color = bal > 0 ? '#f87171' : bal < 0 ? '#34d399' : 'var(--text-muted)';

  const actionsContainer = document.getElementById('as-actions-container');
  if (actionsContainer) {
    if (bal > 0) {
      actionsContainer.innerHTML = `<button class="quick-btn qb-whatsapp" onclick="sendWhatsAppReminder('${s.name.replace(/'/g, "\\'")}', ${bal}, '${s.phone || ''}')" title="Send WhatsApp Reminder">💬 Send Reminder</button>`;
    } else {
      actionsContainer.innerHTML = '';
    }
  }

  const studentTrans = (allDebits || []).filter(d => d.studentId === studentId);

  // Sort by date (newest first)
  studentTrans.sort((a, b) => {
    const dA = a.createdAt || '';
    const dB = b.createdAt || '';
    return dB.localeCompare(dA);
  });

  const tbody = document.getElementById('as-transactions-tbody');
  if (!studentTrans.length) {
    tbody.innerHTML = `<tr><td colspan="4" style="padding: 1.5rem; text-align: center; color: var(--text-muted);">No transactions found.</td></tr>`;
  } else {
    tbody.innerHTML = studentTrans.map(t => {
      const isCredit = t.type === 'credit';
      const color = isCredit ? '#34d399' : '#f87171';
      const typeLabel = isCredit ? 'Credit' : 'Debit';
      const dateStr = t.createdAt ? t.createdAt.split('T')[0] : '—';

      const dateParts = dateStr.split('-');
      const formattedDate = dateParts.length === 3 ? `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}` : dateStr;

      return `<tr style="border-bottom: 1px solid var(--border);">
        <td style="padding: 0.65rem 0.75rem; color: var(--text-muted);">${formattedDate}</td>
        <td style="padding: 0.65rem 0.75rem; font-weight: 500;">${t.description || (isCredit ? 'Credit payment' : 'Debit charge')}</td>
        <td style="padding: 0.65rem 0.75rem;"><span style="color: ${color}; font-weight: 600; font-size: 0.75rem; text-transform: uppercase;">${typeLabel}</span></td>
        <td style="padding: 0.65rem 0.75rem; text-align: right; font-weight: 700; color: ${color};">${isCredit ? '+' : '-'}${fmt(t.amount)}</td>
      </tr>`;
    }).join('');
  }

  openModal('account-statement-modal');
};

window.sendWhatsAppReminder = function (name, amount, phone) {
  if (!phone) {
    toast('⚠️ No phone number available for this student.', 'error');
    return;
  }
  // Sanitize phone number (remove spaces, plus, etc.)
  const cleanPhone = phone.replace(/[^\d+]/g, '');
  const text = `Hello ${name}, this is a reminder that you have pending lab print dues of ₹${amount}. Please clear them soon.`;
  const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`;
  window.open(url, '_blank');
};

// ── Quick Action Modals (per-row in Debtor List) ──────────
window.openQuickCharge = function (studentRecordId) {
  const s = allStudentsCache.find(st => st.id === studentRecordId);
  if (!s) return;
  document.getElementById('qc-student-id').value = s.id;
  document.getElementById('qc-student-name').textContent = s.name;
  document.getElementById('qc-student-meta').textContent =
    [s.studentId, s.batch, s.course].filter(Boolean).join(' · ');
  const bal = s.account_balance ?? 0;
  const balEl = document.getElementById('qc-current-balance');
  balEl.textContent = bal > 0 ? `Due: ${fmt(bal)}` : bal < 0 ? `Advance: ${fmt(Math.abs(bal))}` : 'Cleared';
  balEl.style.color = bal > 0 ? '#f87171' : bal < 0 ? '#34d399' : 'var(--text-muted)';
  document.getElementById('quick-charge-form').reset();
  document.getElementById('qc-alert').innerHTML = '';
  openModal('quick-charge-modal');
};

window.openQuickCollect = function (studentRecordId) {
  const s = allStudentsCache.find(st => st.id === studentRecordId);
  if (!s) return;
  document.getElementById('ql-student-id').value = s.id;
  document.getElementById('ql-student-name').textContent = s.name;
  document.getElementById('ql-student-meta').textContent =
    [s.studentId, s.batch, s.course].filter(Boolean).join(' · ');
  const bal = s.account_balance ?? 0;
  const balEl = document.getElementById('ql-current-balance');
  balEl.textContent = bal > 0 ? `Due: ${fmt(bal)}` : bal < 0 ? `Advance: ${fmt(Math.abs(bal))}` : 'Cleared';
  balEl.style.color = bal > 0 ? '#f87171' : bal < 0 ? '#34d399' : 'var(--text-muted)';
  document.getElementById('quick-collect-form').reset();
  document.getElementById('ql-alert').innerHTML = '';
  openModal('quick-collect-modal');
};

window.handleQuickCharge = async function (e) {
  e.preventDefault();
  const alertEl = document.getElementById('qc-alert');
  const btn = e.target.querySelector('button[type="submit"]');
  setBtnLoading(btn, true);
  const studentId = document.getElementById('qc-student-id').value;
  const description = document.getElementById('qc-description').value.trim();
  const amount = document.getElementById('qc-amount').value;
  alertEl.innerHTML = '';
  const { error } = await applyStudentDebit(studentId, amount, description);
  if (error) { 
    alertEl.innerHTML = `<div class="alert alert-error">⚠️ ${error}</div>`; 
    setBtnLoading(btn, false);
    return; 
  }
  toast(`📤 Charge of ${fmt(amount)} added successfully!`, 'success');
  closeModal('quick-charge-modal');
  setBtnLoading(btn, false);
  await loadDebits();
};

window.handleQuickCollect = async function (e) {
  e.preventDefault();
  const alertEl = document.getElementById('ql-alert');
  const btn = e.target.querySelector('button[type="submit"]');
  setBtnLoading(btn, true);
  const studentId = document.getElementById('ql-student-id').value;
  const description = document.getElementById('ql-description').value.trim();
  const amount = document.getElementById('ql-amount').value;
  alertEl.innerHTML = '';
  const { error } = await applyStudentCredit(studentId, amount, description);
  if (error) { 
    alertEl.innerHTML = `<div class="alert alert-error">⚠️ ${error}</div>`; 
    setBtnLoading(btn, false);
    return; 
  }
  toast(`📥 Collection of ${fmt(amount)} logged successfully!`, 'success');
  closeModal('quick-collect-modal');
  setBtnLoading(btn, false);
  await loadDebits();
};

// ── Searchable Student Dropdown ───────────────────────────
function buildDropdown(prefix, students) {
  const dd = document.getElementById(`${prefix}-dropdown`);
  if (!dd) return;

  if (!students.length) {
    dd.innerHTML =
      '<div class="student-opt" style="color:var(--text-muted);cursor:default">No students found</div>';
    return;
  }

  const items = students
    .map(s => {
      // Escape single quotes in the name for the inline handler
      const safeName = s.name.replace(/'/g, "\\'");
      const badge = s.batch ? `<span class="opt-id">${s.studentId} · ${s.batch}</span>` : '';
      return (
        `<div class="student-opt" onclick="selectStudent('${prefix}','${s.id}','${safeName}','${s.studentId}')">` +
        `<span>${s.name}</span>` +
        badge +
        '</div>'
      );
    })
    .join('');

  dd.innerHTML = items;
}

window.openDropdown = function (prefix) {
  buildDropdown(prefix, allStudentsCache);
  document.getElementById(`${prefix}-dropdown`).classList.add('open');
};

window.filterStudentDropdown = function (prefix) {
  const q = document.getElementById(`${prefix}-search-input`).value.toLowerCase();
  const filtered = allStudentsCache.filter(s =>
    s.name.toLowerCase().includes(q) || s.studentId.toLowerCase().includes(q)
  );
  buildDropdown(prefix, filtered);
  document.getElementById(`${prefix}-dropdown`).classList.add('open');
  // Clear previous selection when typing
  document.getElementById(`${prefix}-student-id`).value = '';
  document.getElementById(`${prefix}-selected-tag`).innerHTML = '';
};

window.selectStudent = function (prefix, id, name, studentId) {
  document.getElementById(`${prefix}-student-id`).value = id;
  document.getElementById(`${prefix}-search-input`).value = '';
  document.getElementById(`${prefix}-dropdown`).classList.remove('open');
  document.getElementById(`${prefix}-selected-tag`).innerHTML =
    `<div class="selected-student-tag">
       🎓 ${name} <span class="td-muted">(${studentId})</span>
       <button type="button" onclick="clearStudent('${prefix}')" title="Clear">✕</button>
     </div>`;
};

window.clearStudent = function (prefix) {
  document.getElementById(`${prefix}-student-id`).value = '';
  document.getElementById(`${prefix}-search-input`).value = '';
  document.getElementById(`${prefix}-selected-tag`).innerHTML = '';
};

// Close dropdowns when clicking outside
document.addEventListener('click', e => {
  ['debit', 'credit'].forEach(p => {
    const wrap = document.getElementById(`${p}-dropdown`);
    const inp = document.getElementById(`${p}-search-input`);
    if (wrap && inp && !wrap.contains(e.target) && e.target !== inp) {
      wrap.classList.remove('open');
    }
  });

  if (!e.target.closest('.action-dropdown-container')) {
    document.querySelectorAll('.action-dropdown-menu.show').forEach(menu => {
      menu.classList.remove('show');
    });
  }
});

window.toggleActionDropdown = function (event, id) {
  event.stopPropagation();
  const dropdown = document.getElementById(`action-dropdown-${id}`);
  if (!dropdown) return;

  const isCurrentlyShowing = dropdown.classList.contains('show');
  
  // Close all other dropdowns
  document.querySelectorAll('.action-dropdown-menu.show').forEach(menu => {
    menu.classList.remove('show');
  });

  // Toggle current one
  if (!isCurrentlyShowing) {
    dropdown.classList.add('show');
    
    // Use fixed positioning to prevent clipping by overflow-x containers
    const btnRect = event.currentTarget.getBoundingClientRect();
    dropdown.style.position = 'fixed';
    
    let top = btnRect.bottom;
    // Prevent cut-off at bottom of screen
    if (top + dropdown.offsetHeight > window.innerHeight) {
      top = btnRect.top - dropdown.offsetHeight;
    }
    
    dropdown.style.top = top + 'px';
    dropdown.style.left = (btnRect.right - dropdown.offsetWidth) + 'px';
    dropdown.style.bottom = 'auto';
    dropdown.style.right = 'auto';
  }
};

// ── Open Modals ────────────────────────────────────────────
window.calculatePrintCost = function () {
  const typeSelect = document.getElementById('debit-print-type');
  const sideSelect = document.getElementById('debit-print-side');
  const pagesInput = document.getElementById('debit-pages');
  const amountInput = document.getElementById('debit-amount');
  const sideGroup = document.getElementById('debit-print-side-group');
  const pagesGroup = document.getElementById('debit-pages-group');
  const amountLabel = document.getElementById('debit-amount-label');

  if (!typeSelect || !sideSelect || !pagesInput || !amountInput) return;

  const type = typeSelect.value;

  if (type === 'opening') {
    if (sideGroup) sideGroup.style.display = 'none';
    if (pagesGroup) pagesGroup.style.display = 'none';
    if (amountLabel) amountLabel.textContent = 'Amount (₹) *';
    amountInput.readOnly = false;
    if (amountInput.value === '3' || !amountInput.value) {
      amountInput.value = '';
    }
  } else {
    if (sideGroup) sideGroup.style.display = 'block';
    if (pagesGroup) pagesGroup.style.display = 'block';
    if (amountLabel) amountLabel.textContent = 'Calculated Amount (₹)';
    amountInput.readOnly = true;

    const side = sideSelect.value;
    const pages = Math.max(1, parseInt(pagesInput.value) || 0);

    let rate = 3;
    if (type === 'bw') {
      rate = side === 'two' ? 4 : 3;
    } else if (type === 'colour') {
      rate = side === 'two' ? 20 : 10;
    }

    const total = rate * pages;
    amountInput.value = total;
  }
};

window.openDebitModal = async function () {
  const { data: students } = await getStudents();
  allStudentsCache = students;
  // Reset form
  document.getElementById('debit-form').reset();
  document.getElementById('debit-student-id').value = '';
  document.getElementById('debit-selected-tag').innerHTML = '';
  document.getElementById('debit-search-input').value = '';
  document.getElementById('debit-dropdown').classList.remove('open');
  document.getElementById('debit-alert').innerHTML = '';
  window.calculatePrintCost();
  openModal('debit-modal');
};

window.openCreditModal = async function () {
  const { data: students } = await getStudents();
  allStudentsCache = students;
  document.getElementById('credit-form').reset();
  document.getElementById('credit-student-id').value = '';
  document.getElementById('credit-selected-tag').innerHTML = '';
  document.getElementById('credit-search-input').value = '';
  document.getElementById('credit-dropdown').classList.remove('open');
  document.getElementById('credit-alert').innerHTML = '';
  openModal('credit-modal');
};

// ── Submit Handlers ────────────────────────────────────────
window.handleDebitSubmit = async function (e) {
  e.preventDefault();
  const alertEl = document.getElementById('debit-alert');
  const studentId = document.getElementById('debit-student-id').value;

  if (!studentId) {
    alertEl.innerHTML = `<div class="alert alert-error">⚠️ Please search and select a student.</div>`;
    return;
  }

  const btn = e.target.querySelector('button[type="submit"]');
  setBtnLoading(btn, true);

  window.calculatePrintCost(); // Ensure we have the latest calculation

  const typeSelect = document.getElementById('debit-print-type');
  const sideSelect = document.getElementById('debit-print-side');
  const pagesInput = document.getElementById('debit-pages');
  const amount = document.getElementById('debit-amount').value;

  const printTypeVal = typeSelect.value;                       // 'bw' | 'colour' | 'opening'
  
  let description, printMeta;
  if (printTypeVal === 'opening') {
    description = 'Previous Arrears / Opening Balance';
    printMeta = {
      print_type: 'opening',
      print_side: null,
      pages: null,
    };
  } else {
    const printSideVal = sideSelect.value;                       // 'one' | 'two'
    const pagesVal = Math.max(1, parseInt(pagesInput.value) || 1);
    const typeLabel = printTypeVal === 'bw' ? 'B&W' : 'Colour';
    const sideLabel = printSideVal === 'two' ? 'Two Side' : 'One Side';
    description = `${pagesVal} pages ${typeLabel} ${sideLabel}`;
    printMeta = {
      print_type: printTypeVal,
      print_side: printSideVal,
      pages: pagesVal,
    };
  }

  alertEl.innerHTML = '';
  const { error } = await applyStudentDebit(studentId, amount, description, printMeta);
  if (error) { 
    alertEl.innerHTML = `<div class="alert alert-error">⚠️ ${error}</div>`; 
    setBtnLoading(btn, false);
    return; 
  }

  toast('Debit charged successfully!', 'success');
  closeModal('debit-modal');
  setBtnLoading(btn, false);
  await loadDebits();
};

window.handleCreditSubmit = async function (e) {
  e.preventDefault();
  const alertEl = document.getElementById('credit-alert');
  const studentId = document.getElementById('credit-student-id').value;
  const description = document.getElementById('credit-description').value.trim();
  const amount = document.getElementById('credit-amount').value;

  if (!studentId) {
    alertEl.innerHTML = `<div class="alert alert-error">⚠️ Please search and select a student.</div>`;
    return;
  }

  const btn = e.target.querySelector('button[type="submit"]');
  setBtnLoading(btn, true);

  alertEl.innerHTML = '';
  const { error } = await applyStudentCredit(studentId, amount, description);
  if (error) { 
    alertEl.innerHTML = `<div class="alert alert-error">⚠️ ${error}</div>`; 
    setBtnLoading(btn, false);
    return; 
  }

  toast('Credit recorded successfully!', 'success');
  closeModal('credit-modal');
  setBtnLoading(btn, false);
  await loadDebits();
};

window.markDebitPaid = async function (id) {
  await updateDebitStatus(id, 'paid');
  toast('Marked as paid.', 'success');
  await loadDebits();
};

// ── Safe Delete with Auto-Reversal (Double-Entry) ────────────
window.handleDeleteDebit = async function (id) {
  // Fetch the entry details first so we can show a descriptive confirm
  const { data: allEntries } = await getDebits();
  const entry = allEntries.find(d => d.id === id);

  if (!entry) {
    toast('Transaction not found.', 'error');
    return;
  }

  const typeLabel = entry.type === 'credit' ? 'Credit (Payment)' : 'Debit (Charge)';
  const reverseMsg = entry.type === 'credit'
    ? `↺ Student's balance will INCREASE by ₹${Number(entry.amount).toLocaleString('en-IN')} (payment un-recorded).\n↺ Revenue ledger will be reduced by the same amount.`
    : `↺ Student's balance will DECREASE by ₹${Number(entry.amount).toLocaleString('en-IN')} (charge removed).\n↺ Revenue ledger will be reduced by the same amount.`;

  const confirmed = confirm(
    `⚠️ Delete & Reverse this transaction?\n\n` +
    `Type    : ${typeLabel}\n` +
    `Student : ${entry.studentName}\n` +
    `Amount  : ₹${Number(entry.amount).toLocaleString('en-IN')}\n` +
    `Desc    : ${entry.description}\n\n` +
    `${reverseMsg}\n\n` +
    `This action cannot be undone.`
  );
  if (!confirmed) return;

  const { error, reversed } = await reverseAndDeleteEntry(id);
  if (error) {
    toast(`❌ ${error}`, 'error');
    return;
  }

  const actionWord = reversed.type === 'credit' ? 'credit reversed' : 'debit removed';
  toast(`✅ Transaction ${actionWord} — ₹${Number(reversed.amount).toLocaleString('en-IN')} for ${reversed.student}.`, 'success');

  // Re-render the debits view AND refresh the dashboard stats
  await loadDebits();
};

// ── Reports ──────────────────────────────────────────────
async function loadReports() {
  const picker = document.getElementById('report-month-picker');
  if (picker && !picker.value) {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    picker.value = `${year}-${month}`;
  }
  await updateMonthlyReport();
}

window.updateMonthlyReport = async function () {
  const picker = document.getElementById('report-month-picker');
  if (!picker) return;
  const monthVal = picker.value; // e.g. "2026-06"
  if (!monthVal) return;

  const { data: rev } = await getRevenue();
  const { data: exp } = await getExpenses();
  const { data: debits } = await getDebits();

  // ── Cash-basis Revenue for selected month ──────────────────
  // Reuse the same whitelist as the Dashboard (_CASH_SOURCES).
  // ONLY 'Direct Cash' and 'Fee Payment' represent actual cash received.
  // Excluded: 'Student Debit' (print charges), 'Manual Credit' (student owes),
  //           'Opening Balance' (pre-existing debt, not new cash).
  const monthCashRev = rev.filter(r => {
    const d = r.date || (r.createdAt ? r.createdAt.split('T')[0] : '');
    const src = (r.source || '').toLowerCase();
    return d.startsWith(monthVal) && _CASH_SOURCES.has(src);
  });
  const totalRev = monthCashRev.reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0);

  // ── Expenses for selected month (unchanged) ────────────────
  const monthExp = exp.filter(e => {
    const d = e.date || (e.createdAt ? e.createdAt.split('T')[0] : '');
    return d.startsWith(monthVal);
  });
  const totalExp = monthExp.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);

  // ── Page counters: Print debits only (source_description === 'Print') ──
  const monthPrintDebits = debits.filter(d => {
    const dateStr = d.createdAt || d.date || '';
    return dateStr.startsWith(monthVal)
      && d.type === 'debit'
      && d.source_description === 'Print';
  });

  let bwPages = 0;
  let colourPages = 0;

  monthPrintDebits.forEach(d => {
    // Prefer stored pages field; fall back to regex on description for legacy entries
    if (typeof d.pages === 'number' && d.print_type) {
      let multiplier = 1;
      const printSide = d.print_side || '';
      const desc = d.description || '';
      if (printSide.toLowerCase().includes('two') || desc.toLowerCase().includes('two side')) {
        multiplier = 2;
      }
      if (d.print_type === 'bw') bwPages += (d.pages * multiplier);
      if (d.print_type === 'colour') colourPages += (d.pages * multiplier);
    } else {
      // Legacy fallback: parse description text e.g. "5 pages B&W Two Side"
      const desc = d.description || '';
      const match = desc.match(/(\d+)\s+pages?\s+(B&W|Colour)/i);
      if (match) {
        let pages = parseInt(match[1]) || 0;
        const type = match[2].toLowerCase();
        if (desc.toLowerCase().includes('two side')) pages *= 2;
        if (type.includes('b&w')) bwPages += pages;
        if (type.includes('colour')) colourPages += pages;
      }
    }
  });

  // ── Update UI cards ────────────────────────────────────────
  document.getElementById('mr-revenue').textContent = fmt(totalRev);
  document.getElementById('mr-expenses').textContent = fmt(totalExp);
  document.getElementById('mr-bw-pages').textContent = bwPages;
  document.getElementById('mr-colour-pages').textContent = colourPages;
};


window.downloadMonthlyReport = async function (e) {
  if (e) e.preventDefault();
  const btn = e ? e.currentTarget || e.target : null;
  setBtnLoading(btn, true);

  const monthVal = document.getElementById('report-month-picker').value;
  if (!monthVal) { 
    toast('Please select a month first.', 'error'); 
    setBtnLoading(btn, false);
    return; 
  }

  const { data: rev } = await getRevenue();
  const { data: exp } = await getExpenses();
  const { data: debits } = await getDebits();

  // ── Helper: resolve the week label (1–4) for a date string ──
  const getWeek = dateStr => {
    const day = parseInt((dateStr || '').split('-')[2] || '1');
    if (day <= 7) return 'Week 1';
    if (day <= 14) return 'Week 2';
    if (day <= 21) return 'Week 3';
    return 'Week 4';
  };

  // ── Helper: categorise a cash revenue row's label ──────────
  // Fee Payment = student paid their print due → label as 'Print Revenue'
  // Direct Cash = admin entered cash manually  → keep exact title
  const revLabel = r =>
    (r.source || '').toLowerCase() === 'fee payment' ? 'Print Revenue' : (r.title || 'Revenue');

  // ── Cash-basis revenue for this month (whitelist) ──────────
  const monthRevAll = rev.filter(r => {
    const d = r.date || (r.createdAt ? r.createdAt.split('T')[0] : '');
    return d.startsWith(monthVal);
  });
  const monthCashRev = monthRevAll.filter(r => _CASH_SOURCES.has((r.source || '').toLowerCase()));
  const totalRev = monthCashRev.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);

  // ── Expenses for this month ────────────────────────────────
  const monthExp = exp.filter(e => {
    const d = e.date || (e.createdAt ? e.createdAt.split('T')[0] : '');
    return d.startsWith(monthVal);
  });
  const totalExp = monthExp.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
  const netBalance = totalRev - totalExp;

  // ── Pending Debits for this month ──────────────────────────
  const monthPendingDebits = debits.filter(d => {
    const dStr = d.createdAt || d.date || '';
    return dStr.startsWith(monthVal) && d.type === 'debit' && d.status === 'pending';
  });
  const totalPending = monthPendingDebits.reduce((s, d) => s + (parseFloat(d.amount) || 0), 0);

  // ── Page counters ──────────────────────────────────────────
  let bwPages = 0, colourPages = 0;
  const monthPrintDebits = debits.filter(d => {
    const ds = d.createdAt || d.date || '';
    return ds.startsWith(monthVal) && d.type === 'debit' && d.source_description === 'Print';
  });
  monthPrintDebits.forEach(d => {
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
  // Legacy fallback
  if (bwPages === 0 && colourPages === 0) {
    monthRevAll.filter(r =>
      (r.source || '').toLowerCase() === 'student debit' ||
      (r.description || '').toLowerCase() === 'print'
    ).forEach(r => {
      const m = (r.title || '').match(/(\d+)\s+pages?\s+(B&W|Colour)/i);
      if (m) {
        let p = parseInt(m[1]) || 0;
        if ((r.title || '').toLowerCase().includes('two side')) p *= 2;
        if (m[2].toLowerCase().includes('b&w')) bwPages += p;
        if (m[2].toLowerCase().includes('colour')) colourPages += p;
      }
    });
  }

  // ── GROUP REVENUE BY WEEK × CATEGORY ──────────────────────
  const revByWeek = {};
  monthCashRev.forEach(r => {
    const d = r.date || (r.createdAt ? r.createdAt.split('T')[0] : '');
    const week = getWeek(d);
    const lbl = revLabel(r);
    if (!revByWeek[week]) revByWeek[week] = {};
    revByWeek[week][lbl] = (revByWeek[week][lbl] || 0) + (parseFloat(r.amount) || 0);
  });

  // ── GROUP EXPENSES BY WEEK × TITLE ────────────────────────
  const expByWeek = {};
  monthExp.forEach(e => {
    const d = e.date || (e.createdAt ? e.createdAt.split('T')[0] : '');
    const week = getWeek(d);
    const lbl = e.title || 'Expense';
    if (!expByWeek[week]) expByWeek[week] = {};
    expByWeek[week][lbl] = (expByWeek[week][lbl] || 0) + (parseFloat(e.amount) || 0);
  });

  // ── Build Revenue table rows ───────────────────────────────
  const WEEKS = ['Week 1', 'Week 2', 'Week 3', 'Week 4'];
  let revRowsHtml = '';
  WEEKS.forEach(week => {
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

  // ── Build Expense table rows ───────────────────────────────
  let expRowsHtml = '';
  WEEKS.forEach(week => {
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

  // ── Print window ───────────────────────────────────────────
  const printWindow = window.open('', '_blank');
  printWindow.document.write(`
    <html><head>
      <title>Monthly Report - ${monthVal}</title>
      <style>
        body { font-family: system-ui, sans-serif; padding: 2rem; color: #1e293b; background: #fff; line-height: 1.5; }
        .header { text-align: center; margin-bottom: 2rem; border-bottom: 2px solid #e2e8f0; padding-bottom: 1rem; }
        .header h1 { margin: 0 0 .25rem; color: #0f172a; font-size: 22px; }
        .header p  { margin: 0; color: #64748b; font-size: 13px; }
        .grid { display: grid; grid-template-columns: repeat(6, 1fr); gap: 1rem; margin-bottom: 2.5rem; }
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
        <p>Report Month: ${monthVal}</p>
      </div>
      <div class="grid">
        <div class="card"><div class="label">Total Revenue</div><div class="value text-success">${fmt(totalRev)}</div></div>
        <div class="card"><div class="label">Total Expenses</div><div class="value text-danger">${fmt(totalExp)}</div></div>
        <div class="card"><div class="label">Net Balance</div><div class="value ${netBalance >= 0 ? 'text-success' : 'text-danger'}">${fmt(netBalance)}</div></div>
        <div class="card"><div class="label">Pending Debits</div><div class="value" style="color:#f59e0b">${fmt(totalPending)}</div></div>
        <div class="card"><div class="label">B&amp;W Pages</div><div class="value">${bwPages}</div></div>
        <div class="card"><div class="label">Colour Pages</div><div class="value">${colourPages}</div></div>
      </div>
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
  toast('Monthly report opened!', 'success');
  setBtnLoading(btn, false);
};
  window.generateYearlyReport = async function (e) {
  if (e) e.preventDefault();
  const btn = e ? e.currentTarget || e.target : null;
  setBtnLoading(btn, true);

  const fromDateVal = document.getElementById('report-from-date')?.value;
  const toDateVal = document.getElementById('report-to-date')?.value;
  if (!fromDateVal || !toDateVal) {
    toast('Please select both From Date and To Date.', 'error');
    setBtnLoading(btn, false);
    return;
  }

  const startDate = new Date(fromDateVal);
  const endDate = new Date(toDateVal + 'T23:59:59');

  const { data: rev } = await getRevenue();
  const { data: exp } = await getExpenses();
  const { data: debits } = await getDebits();

  const parseTxDate = tx => {
    const ds = tx.date || tx.createdAt || '';
    return ds ? new Date(ds) : null;
  };

  // ── Cash-basis revenue for this period (whitelist) ──
  const yearRevAll = rev.filter(r => {
    const txDate = parseTxDate(r);
    return txDate && txDate >= startDate && txDate <= endDate;
  });
  const yearCashRev = yearRevAll.filter(r => _CASH_SOURCES.has((r.source || '').toLowerCase()));
  const totalRev = yearCashRev.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);

  // ── Expenses for this period ──────────────────────────────
  const yearExp = exp.filter(e => {
    const txDate = parseTxDate(e);
    return txDate && txDate >= startDate && txDate <= endDate;
  });
  const totalExp = yearExp.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
  const netBalance = totalRev - totalExp;

  // ── Pending Debits for this period ────────────────────────
  const periodPendingDebits = debits.filter(d => {
    const txDate = parseTxDate(d);
    return txDate && txDate >= startDate && txDate <= endDate && d.type === 'debit' && d.status === 'pending';
  });
  const totalPending = periodPendingDebits.reduce((s, d) => s + (parseFloat(d.amount) || 0), 0);

  // ── Page counters ──────────────────────────────────────────
  let bwPages = 0, colourPages = 0;
  const yearPrintDebits = debits.filter(d => {
    const txDate = parseTxDate(d);
    return txDate && txDate >= startDate && txDate <= endDate && d.type === 'debit' && d.source_description === 'Print';
  });
  yearPrintDebits.forEach(d => {
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

  if (bwPages === 0 && colourPages === 0) {
    yearRevAll.filter(r =>
      (r.source || '').toLowerCase() === 'student debit' ||
      (r.description || '').toLowerCase() === 'print'
    ).forEach(r => {
      const m = (r.title || '').match(/(\d+)\s+pages?\s+(B&W|Colour)/i);
      if (m) {
        let p = parseInt(m[1]) || 0;
        if ((r.title || '').toLowerCase().includes('two side')) p *= 2;
        if (m[2].toLowerCase().includes('b&w')) bwPages += p;
        if (m[2].toLowerCase().includes('colour')) colourPages += p;
      }
    });
  }

  // Define month names
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  // Group cash revenue and expenses by YYYY-MM key
  const revByMonthKey = {};
  yearCashRev.forEach(r => {
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

  yearExp.forEach(e => {
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

  // Sort the keys chronologically
  const sortedKeys = Object.keys(revByMonthKey).sort();

  let monthRowsHtml = '';
  let runningBalance = 0;
  let hasAnyData = false;

  sortedKeys.forEach(key => {
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

  if (!hasAnyData) {
    monthRowsHtml = '<tr><td colspan="5" style="text-align:center;color:#64748b">No transactions recorded in this range.</td></tr>';
  }

  const netStatusLabel = netBalance >= 0 ? 'Surplus' : 'Deficit';
  const netStatusColorClass = netBalance >= 0 ? 'text-success' : 'text-danger';

  // ── Print window ───────────────────────────────────────────
  const printWindow = window.open('', '_blank');
  printWindow.document.write(`
    <html><head>
      <title>Custom Date Range Report</title>
      <style>
        body { font-family: system-ui, sans-serif; padding: 2rem; color: #1e293b; background: #fff; line-height: 1.5; }
        .header { text-align: center; margin-bottom: 2rem; border-bottom: 2px solid #e2e8f0; padding-bottom: 1rem; }
        .header h1 { margin: 0 0 .25rem; color: #0f172a; font-size: 22px; }
        .header p  { margin: 0; color: #64748b; font-size: 13px; }
        .grid { display: grid; grid-template-columns: repeat(6, 1fr); gap: 1rem; margin-bottom: 2.5rem; }
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
        <p>Report Period: ${fromDateVal} to ${toDateVal}</p>
      </div>

      <div class="grid">
        <div class="card"><div class="label">Total Collections</div><div class="value" style="color:#16a34a">${fmt(totalRev)}</div></div>
        <div class="card"><div class="label">Total Expenses</div><div class="value" style="color:#dc2626">${fmt(totalExp)}</div></div>
        <div class="card"><div class="label">Net Status</div><div class="value ${netStatusColorClass}">${netStatusLabel}: ${fmt(Math.abs(netBalance))}</div></div>
        <div class="card"><div class="label">Pending Debits</div><div class="value" style="color:#f59e0b">${fmt(totalPending)}</div></div>
        <div class="card"><div class="label">B&amp;W Pages</div><div class="value">${bwPages}</div></div>
        <div class="card"><div class="label">Colour Pages</div><div class="value">${colourPages}</div></div>
      </div>

      <div class="section-title">Month-by-Month Summary — Period ${fromDateVal} to ${toDateVal}</div>
      <table>
        <thead><tr>
          <th>Month</th>
          <th class="text-right">Revenue</th>
          <th class="text-right">Expenses</th>
          <th class="text-right">Net (Month)</th>
          <th class="text-right">Running Balance</th>
        </tr></thead>
        <tbody>${monthRowsHtml}</tbody>
        <tfoot><tr>
          <td><strong>Total</strong></td>
          <td class="text-right text-success">${fmt(totalRev)}</td>
          <td class="text-right text-danger">${fmt(totalExp)}</td>
          <td class="text-right ${netBalance >= 0 ? 'text-success' : 'text-danger'}">${fmt(netBalance)}</td>
          <td class="text-right"></td>
        </tr></tfoot>
      </table>

      <script>window.onload=function(){setTimeout(function(){window.print();},300);};<\/script>
    </body></html>
  `);
  printWindow.document.close();
  toast('Yearly report opened!', 'success');
  setBtnLoading(btn, false);
};

// ── Debtor Management Reports ──────────────────────────────
window.printDebtorReport = function () {
  const students = allStudentsCache || [];
  const debits = allDebits || [];
  const relevant = students.filter(s =>
    (s.account_balance ?? 0) !== 0 || debits.some(d => d.studentId === s.id)
  );

  let totalDue = 0;
  let totalAdvance = 0;
  relevant.forEach(s => {
    const bal = s.account_balance ?? 0;
    if (bal > 0) totalDue += bal;
    else if (bal < 0) totalAdvance += Math.abs(bal);
  });
  const netOutstanding = totalDue - totalAdvance;

  // Split relevant into two columns
  const half = Math.ceil(relevant.length / 2);
  const leftCol = relevant.slice(0, half);
  const rightCol = relevant.slice(half);

  const makeRows = list => {
    let rowsHtml = '';
    list.forEach(s => {
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
  toast('Debtor report opened!', 'success');
};

window.downloadDebtorCSV = function () {
  const students = allStudentsCache || [];
  const debits = allDebits || [];
  const relevant = students.filter(s =>
    (s.account_balance ?? 0) !== 0 || debits.some(d => d.studentId === s.id)
  );

  let csvContent = "\uFEFF"; // UTF-8 BOM
  csvContent += "Student Name,Student ID,Batch,Course,Department,Balance Status,Balance Amount\r\n";

  relevant.forEach(s => {
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
    ].map(val => `"${String(val).replace(/"/g, '""')}"`).join(",");
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
  toast('Debtor report CSV download started!', 'success');
};

// ── Reset Financial Data (Danger Zone) ────────────────────
window.handleResetFinancialData = function (e) {
  e.preventDefault();
  const input = document.getElementById('reset-confirm-input');
  if (input) input.value = '';
  const cb = document.getElementById('reset-delete-students-cb');
  if (cb) cb.checked = false;
  const alertEl = document.getElementById('reset-modal-alert');
  if (alertEl) {
    alertEl.style.display = 'none';
    alertEl.textContent = '';
  }
  openModal('reset-modal');
};

window.submitResetModalConfirm = async function () {
  const input = document.getElementById('reset-confirm-input');
  const alertEl = document.getElementById('reset-modal-alert');

  if (!input || input.value.trim() !== 'DELETE') {
    if (alertEl) {
      alertEl.textContent = "⚠️ Please type 'DELETE' exactly to confirm.";
      alertEl.style.display = 'block';
    }
    return;
  }

  const deleteStudentsAlso = document.getElementById('reset-delete-students-cb')?.checked || false;

  if (alertEl) alertEl.style.display = 'none';
  window.closeModal('reset-modal');

  try {
    // 1. Gather pre-delete financial data
    const { data: summary } = await getFinancialSummary();
    const { data: debits } = await getDebits();
    const { data: revenue } = await getRevenue();

    const totalExpenses = summary?.totalExpenses || 0;
    const cashInHand = summary?.cashInHand || 0;
    const pendingDebits = summary?.pendingDebits || 0;
    const totalRevenue = (revenue || []).reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0);

    const pendingList = (debits || []).filter(d => d.status === 'pending');

    let pendingRowsHtml = '';
    pendingList.forEach(d => {
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
      <div class="print-only" style="font-family: system-ui, sans-serif; padding: 2rem; color: #1e293b; background: #fff; line-height: 1.5; min-height: 100vh;">
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

    // Replace the current body with the print report HTML layout
    document.body.innerHTML = reportHtml;

    // Set up window.onafterprint event listener to execute database deletion after printing
    window.onafterprint = async function () {
      // Show Deleting loading state
      document.body.innerHTML = `
        <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100vh; background:#0a0f1e; color:#fff; font-family:system-ui, sans-serif; text-align:center;">
          <div style="font-size: 3rem; margin-bottom: 1rem; animation: pulse 1.5s infinite;">⏳</div>
          <h2 style="margin: 0; font-size: 1.5rem; font-weight: 700;">Deleting data...</h2>
          <p style="color: #64748b; font-size: 0.9rem; margin-top: 0.5rem;">Wiping financial database. Please do not close this tab.</p>
          <style>
            @keyframes pulse {
              0% { transform: scale(1); opacity: 1; }
              50% { transform: scale(1.1); opacity: 0.7; }
              100% { transform: scale(1); opacity: 1; }
            }
          </style>
        </div>
      `;

      try {
        const { supabase } = await import('./storage.service.js');
        const dummyUuid = '00000000-0000-0000-0000-000000000000';

        // 3. Strict Deletion Logic (Inside try...catch) with UUID filters
        const { error: revErr } = await supabase.from('revenue').delete().neq('id', dummyUuid);
        if (revErr) throw revErr;

        const { error: expErr } = await supabase.from('expenses').delete().neq('id', dummyUuid);
        if (expErr) throw expErr;

        const { error: debErr } = await supabase.from('debits').delete().neq('id', dummyUuid);
        if (debErr) throw debErr;

        if (deleteStudentsAlso) {
          // Delete students
          const { error: studDelErr } = await supabase.from('students').delete().neq('id', dummyUuid);
          if (studDelErr) throw studDelErr;

          // Delete student users
          const { error: userDelErr } = await supabase.from('users').delete().eq('role', 'student');
          if (userDelErr) throw userDelErr;
        } else {
          // Reset only student balances
          const { error: studErr } = await supabase.from('students').update({ account_balance: 0 }).neq('id', dummyUuid);
          if (studErr) throw studErr;
        }

        // 4. Clear Local Cache
        localStorage.clear();

        // 5. Success & Reload
        alert('Backup printed and all data reset successfully!');
        window.location.reload();
      } catch (dbErr) {
        console.error('Database reset failed:', dbErr);
        alert(`Reset failed: ${dbErr.message || dbErr}`);
        window.location.reload();
      }
    };

    // Immediately trigger the print dialog
    setTimeout(() => {
      window.print();
    }, 300);

  } catch (err) {
    alert(`Unexpected error: ${err.message}`);
    window.location.reload();
  }
};

// ── Delete All Student Accounts ───────────────────────────
window.handleDeleteAllStudents = function (e) {
  if (e) e.preventDefault();
  const input = document.getElementById('delall-confirm-input');
  if (input) input.value = '';
  const alertEl = document.getElementById('delall-modal-alert');
  if (alertEl) {
    alertEl.style.display = 'none';
    alertEl.textContent = '';
  }
  openModal('delete-all-students-modal');
};

window.submitDeleteAllStudentsConfirm = async function () {
  const input = document.getElementById('delall-confirm-input');
  const alertEl = document.getElementById('delall-modal-alert');

  if (!input || input.value.trim() !== 'DELETE ALL') {
    if (alertEl) {
      alertEl.textContent = "⚠️ Please type 'DELETE ALL' exactly to confirm.";
      alertEl.style.display = 'block';
    }
    return;
  }

  if (alertEl) alertEl.style.display = 'none';
  window.closeModal('delete-all-students-modal');

  // Show full-screen loading state
  document.body.innerHTML = `
    <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100vh; background:#0a0f1e; color:#fff; font-family:system-ui, sans-serif; text-align:center;">
      <div style="font-size: 3rem; margin-bottom: 1rem; animation: pulse 1.5s infinite;">⏳</div>
      <h2 style="margin: 0; font-size: 1.5rem; font-weight: 700;">Deleting all student accounts...</h2>
      <p style="color: #64748b; font-size: 0.9rem; margin-top: 0.5rem;">Wiping students database. Please do not close this tab.</p>
      <style>
        @keyframes pulse {
          0% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.1); opacity: 0.7; }
          100% { transform: scale(1); opacity: 1; }
        }
      </style>
    </div>
  `;

  try {
    const { supabase } = await import('./storage.service.js');
    const dummyUuid = '00000000-0000-0000-0000-000000000000';

    // 1. Delete all debits first because they reference students
    const { error: debErr } = await supabase.from('debits').delete().neq('id', dummyUuid);
    if (debErr) throw debErr;

    // 2. Delete all students
    const { error: studDelErr } = await supabase.from('students').delete().neq('id', dummyUuid);
    if (studDelErr) throw studDelErr;

    // 3. Delete student users from users table (role = 'student')
    const { error: userDelErr } = await supabase.from('users').delete().eq('role', 'student');
    if (userDelErr) throw userDelErr;

    // 4. Clear local cache
    localStorage.clear();

    alert('All student accounts deleted successfully!');
    window.location.reload();
  } catch (err) {
    console.error('Delete all students failed:', err);
    alert(`Failed to delete student accounts: ${err.message || err}`);
    window.location.reload();
  }
};

  // ── Init ─────────────────────────────────────────────────
  loadDashboard();

