import {
  getCurrentUser, logoutUser,
  getStudentByStudentId, getDebits, updateStudent
} from './storage.service.js';

// ── Auth Guard ──────────────────────────────────────────
let studentId = localStorage.getItem('student_id');
let user = getCurrentUser();
if (!studentId) {
  if (user && user.role === 'student') {
    studentId = user.username;
    localStorage.setItem('student_id', studentId);
  } else {
    window.location.href = 'login.html';
  }
}

let myStudent = null;

// ── Navigation ──────────────────────────────────────────
const titles = {
  overview:  ['Account Overview', 'Your financial summary'],
  debits:    ['My Debits & Dues', 'Your pending charges'],
  statement: ['Account Statement', 'Full transaction record'],
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

async function loadSection(section) {
  if (section === 'overview') await loadOverview();
  else if (section === 'debits') await loadMyDebits();
  else if (section === 'statement') await loadStatement();
}

// ── Helpers ─────────────────────────────────────────────
const fmt = n => '₹' + Number(n || 0).toLocaleString('en-IN');
const fmtDate = d => d ? new Date(d).toLocaleDateString('en-IN') : '—';

function toast(msg, type = 'info') {
  const icons = { success: '✅', error: '❌', info: 'ℹ️' };
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.textContent = `${icons[type]} ${msg}`;
  document.getElementById('toast-container').appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

// ── Load Student Data ────────────────────────────────────
async function init() {
  const { data, error } = await getStudentByStudentId(studentId);
  if (error || !data) {
    toast('Could not load your student record.', 'error');
    return;
  }
  myStudent = data;

  // Sidebar
  document.getElementById('sidebar-name').textContent = myStudent.name;
  document.getElementById('sidebar-avatar').textContent = myStudent.name[0].toUpperCase();
  document.getElementById('student-id-badge').textContent = myStudent.studentId;

  await loadOverview();
}

// ── Overview ─────────────────────────────────────────────
async function loadOverview() {
  if (!myStudent) return;
  const s = myStudent;
  const feeDue = s.totalFee - s.paidAmount;

  // Pending debits
  const { data: debits } = await getDebits(s.id);
  const pendingDebitTotal = (debits || [])
    .filter(d => d.status === 'pending')
    .reduce((sum, d) => sum + d.amount, 0);

  const totalOutstanding = feeDue + pendingDebitTotal;

  // Balance hero
  document.getElementById('balance-amount').textContent = fmt(totalOutstanding);
  document.getElementById('balance-due-msg').textContent =
    totalOutstanding > 0 ? `⚠️ You have ${fmt(totalOutstanding)} outstanding balance.`
    : '✅ Your fees are fully paid!';
  document.getElementById('balance-amount').style.color =
    totalOutstanding > 0 ? 'var(--danger)' : 'var(--success)';

  // Profile grid
  const fields = [
    ['Student ID', s.studentId],
    ['Full Name', s.name],
    ['Batch', s.batch || '—'],
    ['Phone', s.phone || '—'],
    ['Enrolled', fmtDate(s.createdAt)],
  ];
  document.getElementById('profile-grid').innerHTML = fields.map(([label, val]) => `
    <div style="padding:.6rem 0;border-bottom:1px solid var(--border)">
      <div style="font-size:.72rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:.2rem">${label}</div>
      <div style="font-size:.9rem;font-weight:500">${val}</div>
    </div>`).join('');
}

// ── My Debits ────────────────────────────────────────────
async function loadMyDebits() {
  if (!myStudent) return;
  const { data: debits } = await getDebits(myStudent.id);
  const total = debits.filter(d => d.status === 'pending').reduce((s, d) => s + d.amount, 0);
  document.getElementById('debit-total-badge').textContent = `Pending: ${fmt(total)}`;

  const tbody = document.getElementById('my-debits-tbody');
  if (!debits.length) {
    tbody.innerHTML = `<tr><td colspan="5"><div class="empty-state"><div class="empty-icon">📒</div>No debit entries for your account.</div></td></tr>`;
    return;
  }
  tbody.innerHTML = [...debits].reverse().map(d => {
    const sc = d.status === 'paid' ? 'badge-success' : d.status === 'partial' ? 'badge-warning' : 'badge-danger';
    return `<tr>
      <td><strong>${d.description}</strong></td>
      <td class="${d.status === 'paid' ? 'text-success' : 'text-danger'} fw-bold">${fmt(d.amount)}</td>
      <td class="td-muted">${fmtDate(d.dueDate)}</td>
      <td><span class="badge ${sc}">${d.status}</span></td>
      <td class="td-muted">${fmtDate(d.createdAt)}</td>
    </tr>`;
  }).join('');
}

// ── Statement ─────────────────────────────────────────────
async function loadStatement() {
  if (!myStudent) return;
  const s = myStudent;
  const { data: debits } = await getDebits(s.id);

  document.getElementById('statement-info').innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:1rem;padding:1rem;background:var(--bg-card);border-radius:var(--radius-sm);margin-bottom:1rem">
      <div><div style="font-size:.72rem;color:var(--text-muted);text-transform:uppercase">Total Fee</div><div style="font-size:1.2rem;font-weight:700">${fmt(s.totalFee)}</div></div>
      <div><div style="font-size:.72rem;color:var(--text-muted);text-transform:uppercase">Amount Paid</div><div style="font-size:1.2rem;font-weight:700;color:var(--success)">${fmt(s.paidAmount)}</div></div>
      <div><div style="font-size:.72rem;color:var(--text-muted);text-transform:uppercase">Balance Due</div><div style="font-size:1.2rem;font-weight:700;color:var(--danger)">${fmt(s.totalFee - s.paidAmount)}</div></div>
    </div>`;

  const rows = [];
  // Fee payment row
  if (s.paidAmount > 0) {
    rows.push({ type: 'Fee Payment', desc: 'Tuition fee payment received', amount: s.paidAmount, status: 'completed', date: s.createdAt, credit: true });
  }
  // Debits
  debits.forEach(d => {
    rows.push({ type: 'Debit', desc: d.description, amount: d.amount, status: d.status, date: d.createdAt, credit: false });
  });
  // Outstanding fee
  const due = s.totalFee - s.paidAmount;
  if (due > 0) {
    rows.push({ type: 'Fee Balance', desc: 'Outstanding tuition fee', amount: due, status: 'pending', date: new Date().toISOString(), credit: false });
  }

  const tbody = document.getElementById('statement-tbody');
  tbody.innerHTML = rows.length ? rows.map((r, i) => `<tr>
    <td class="td-muted">${i + 1}</td>
    <td><span class="badge ${r.credit ? 'badge-success' : 'badge-info'}">${r.type}</span></td>
    <td>${r.desc}</td>
    <td class="${r.credit ? 'text-success' : 'text-danger'} fw-bold">${r.credit ? '+' : '-'}${fmt(r.amount)}</td>
    <td><span class="badge ${r.status === 'completed' || r.status === 'paid' ? 'badge-success' : 'badge-warning'}">${r.status}</span></td>
    <td class="td-muted">${fmtDate(r.date)}</td>
  </tr>`).join('') : `<tr><td colspan="6"><div class="empty-state">No transactions yet.</div></td></tr>`;
}

// ── Download My Statement ─────────────────────────────────
window.downloadMyStatement = async function (e) {
  if (!myStudent) return;
  const btn = e ? e.currentTarget || e.target : null;
  setBtnLoading(btn, true);

  const s = myStudent;
  const { data: debits } = await getDebits(s.id);
  let csv = `Lab Accounts - Personal Statement\nStudent: ${s.name}\nID: ${s.studentId}\n\n`;
  csv += 'Type,Description,Amount,Status,Date\n';
  if (s.paidAmount > 0) csv += `Fee Payment,Tuition fee payment,${s.paidAmount},completed,${s.createdAt}\n`;
  debits.forEach(d => { csv += `Debit,${d.description},${d.amount},${d.status},${d.createdAt}\n`; });
  const due = s.totalFee - s.paidAmount;
  if (due > 0) csv += `Fee Balance,Outstanding tuition fee,${due},pending,${new Date().toISOString()}\n`;

  const a = document.createElement('a');
  a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
  a.download = `statement_${s.studentId}.csv`;
  a.click();
  toast('Statement downloaded!', 'success');
  setBtnLoading(btn, false);
};

// ── Edit Profile Modal Controls ───────────────────────────
window.openEditProfileModal = function () {
  if (!myStudent) return;
  document.getElementById('ep-name').value = myStudent.name;
  document.getElementById('ep-phone').value = myStudent.phone || '';
  document.getElementById('ep-alert').innerHTML = '';
  document.getElementById('edit-profile-modal').classList.add('open');
};

window.closeModal = function (modalId) {
  document.getElementById(modalId).classList.remove('open');
};

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

window.handleEditProfileSubmit = async function (e) {
  e.preventDefault();
  const alertEl = document.getElementById('ep-alert');
  alertEl.innerHTML = '';

  const name = document.getElementById('ep-name').value.trim();
  const phone = document.getElementById('ep-phone').value.trim();

  if (!name) {
    alertEl.innerHTML = `<div class="alert alert-error">⚠️ Name is required.</div>`;
    return;
  }
  if (!phone) {
    alertEl.innerHTML = `<div class="alert alert-error">⚠️ Phone number is required.</div>`;
    return;
  }

  const btn = e.target.querySelector('button[type="submit"]');
  setBtnLoading(btn, true);

  try {
    const { data: updatedStudent, error } = await updateStudent(myStudent.id, { name, phone });

    if (error) {
      alertEl.innerHTML = `<div class="alert alert-error">⚠️ ${error}</div>`;
      setBtnLoading(btn, false);
      return;
    }

    // Update users table name as well if userId is present
    if (myStudent.userId) {
      try {
        const SUPABASE_URL = 'https://exwnfnqpuzqrzkjprbji.supabase.co';
        const SUPABASE_KEY = 'sb_publishable_HaX6LPhPg1kZ2g1V-7w-3A_13de8qDy';
        const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
        await supabase.from('users').update({ name }).eq('id', myStudent.userId);

        // Keep standard user session name updated
        const currentUser = getCurrentUser();
        if (currentUser && currentUser.id === myStudent.userId) {
          currentUser.name = name;
          localStorage.setItem('lab_current_user', JSON.stringify(currentUser));
        }
      } catch (err) {
        console.error("Failed to update user table name:", err);
      }
    }

    myStudent = updatedStudent;

    // Re-render layout
    document.getElementById('sidebar-name').textContent = myStudent.name;
    document.getElementById('sidebar-avatar').textContent = myStudent.name[0].toUpperCase();
    await loadOverview();

    closeModal('edit-profile-modal');
    toast('Profile updated successfully!', 'success');
  } catch (err) {
    alertEl.innerHTML = `<div class="alert alert-error">⚠️ ${err.message}</div>`;
  } finally {
    setBtnLoading(btn, false);
  }
};

// ── Logout ────────────────────────────────────────────────
window.handleLogout = function () {
  logoutUser();
  localStorage.removeItem('student_id');
  window.location.href = 'login.html';
};

// ── Init ─────────────────────────────────────────────────
init();
