import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import {
  getCurrentUser,
  logoutUser,
  getStudentByStudentId,
  getDebits,
  updateStudent,
  supabase
} from '../js/storage.service';

export default function StudentDashboard() {
  const router = useRouter();
  const [studentId, setStudentId] = useState(null);
  const [myStudent, setMyStudent] = useState(null);
  const [activeSection, setActiveSection] = useState('overview');
  const [debits, setDebits] = useState([]);
  const [toasts, setToasts] = useState([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editAlert, setEditAlert] = useState(null);
  const [modalLoading, setModalLoading] = useState(false);

  useEffect(() => {
    let storedId = localStorage.getItem('student_id');
    const user = getCurrentUser();
    if (!storedId) {
      if (user && user.role === 'student') {
        storedId = user.username;
        localStorage.setItem('student_id', storedId);
      } else {
        router.replace('/login');
        return;
      }
    }
    setStudentId(storedId);
  }, [router]);

  useEffect(() => {
    if (studentId) {
      loadStudentData();
    }
  }, [studentId]);

  const loadStudentData = async () => {
    const { data, error } = await getStudentByStudentId(studentId);
    if (error || !data) {
      addToast('Could not load your student record.', 'error');
      return;
    }
    setMyStudent(data);

    // Fetch debits
    const { data: dbDebits } = await getDebits(data.id);
    setDebits(dbDebits || []);
  };

  const addToast = (msg, type = 'info') => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, msg, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  };

  const handleSignOut = () => {
    logoutUser();
    localStorage.removeItem('student_id');
    localStorage.removeItem('auto_login_student');
    router.replace('/login');
  };

  const fmt = (n) => '₹' + Number(n || 0).toLocaleString('en-IN');
  const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-IN') : '—');

  // Overview calculations
  const feeDue = myStudent ? myStudent.totalFee - myStudent.paidAmount : 0;
  const pendingDebitTotal = debits
    .filter((d) => d.status === 'pending')
    .reduce((sum, d) => sum + d.amount, 0);
  const totalOutstanding = feeDue + pendingDebitTotal;

  // Statement calculations
  const statementRows = [];
  if (myStudent) {
    if (myStudent.paidAmount > 0) {
      statementRows.push({
        type: 'Fee Payment',
        desc: 'Tuition fee payment received',
        amount: myStudent.paidAmount,
        status: 'completed',
        date: myStudent.createdAt,
        credit: true,
      });
    }
    debits.forEach((d) => {
      statementRows.push({
        type: 'Debit',
        desc: d.description,
        amount: d.amount,
        status: d.status,
        date: d.createdAt,
        credit: false,
      });
    });
    if (feeDue > 0) {
      statementRows.push({
        type: 'Fee Balance',
        desc: 'Outstanding tuition fee',
        amount: feeDue,
        status: 'pending',
        date: new Date().toISOString(),
        credit: false,
      });
    }
  }

  const downloadMyStatement = () => {
    if (!myStudent) return;
    let csv = `Lab Accounts - Personal Statement\nStudent: ${myStudent.name}\nID: ${myStudent.studentId}\n\n`;
    csv += 'Type,Description,Amount,Status,Date\n';
    if (myStudent.paidAmount > 0) {
      csv += `Fee Payment,Tuition fee payment,${myStudent.paidAmount},completed,${myStudent.createdAt}\n`;
    }
    debits.forEach((d) => {
      csv += `Debit,${d.description},${d.amount},${d.status},${d.createdAt}\n`;
    });
    if (feeDue > 0) {
      csv += `Fee Balance,Outstanding tuition fee,${feeDue},pending,${new Date().toISOString()}\n`;
    }

    const a = document.createElement('a');
    a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
    a.download = `statement_${myStudent.studentId}.csv`;
    a.click();
    addToast('Statement downloaded!', 'success');
  };

  const openEditProfileModal = () => {
    if (!myStudent) return;
    setEditName(myStudent.name);
    setEditPhone(myStudent.phone || '');
    setEditAlert(null);
    setIsEditModalOpen(true);
  };

  const handleEditProfileSubmit = async (e) => {
    e.preventDefault();
    setEditAlert(null);

    if (!editName.trim()) {
      setEditAlert({ type: 'error', text: '⚠️ Name is required.' });
      return;
    }
    if (!editPhone.trim()) {
      setEditAlert({ type: 'error', text: '⚠️ Phone number is required.' });
      return;
    }

    setModalLoading(true);

    try {
      const { data: updatedStudent, error } = await updateStudent(myStudent.id, {
        name: editName.trim(),
        phone: editPhone.trim(),
      });

      if (error) {
        setEditAlert({ type: 'error', text: `⚠️ ${error}` });
        setModalLoading(false);
        return;
      }

      if (myStudent.userId) {
        try {
          await supabase.from('users').update({ name: editName.trim() }).eq('id', myStudent.userId);
          const currentUser = getCurrentUser();
          if (currentUser && currentUser.id === myStudent.userId) {
            currentUser.name = editName.trim();
            localStorage.setItem('lab_current_user', JSON.stringify(currentUser));
          }
        } catch (err) {
          console.error('Failed to update users table name:', err);
        }
      }

      setMyStudent(updatedStudent);
      setIsEditModalOpen(false);
      addToast('Profile updated successfully!', 'success');
    } catch (err) {
      setEditAlert({ type: 'error', text: `⚠️ ${err.message}` });
    } finally {
      setModalLoading(false);
    }
  };

  if (!myStudent) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#0a0f1e', color: '#fff', fontFamily: 'system-ui, sans-serif' }}>
        <div>Loading dashboard...</div>
      </div>
    );
  }

  return (
    <div className="dashboard">
      <div className="toast-container">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.type}`}>
            {t.type === 'success' ? '✅' : t.type === 'error' ? '❌' : 'ℹ️'} {t.msg}
          </div>
        ))}
      </div>

      {/* ── Sidebar ── */}
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`} id="sidebar">
        <div className="sidebar-logo">
          <div className="logo-mark">
            <div className="logo-icon-sm">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="3" width="20" height="14" rx="2"/>
                <line x1="8" y1="21" x2="16" y2="21"/>
                <line x1="12" y1="17" x2="12" y2="21"/>
              </svg>
            </div>
            <div className="logo-text">Lab Accounts <span>Student Portal</span></div>
          </div>
          <button className="btn btn-outline btn-sm sidebar-close" style={{ display: 'none' }} onClick={() => setSidebarOpen(false)}>✕</button>
        </div>

        <nav className="nav-section">
          <div className="nav-label">My Account</div>
          <div
            className={`nav-item ${activeSection === 'overview' ? 'active' : ''}`}
            onClick={() => { setActiveSection('overview'); setSidebarOpen(false); }}
          >
            <span className="nav-icon">📊</span> Account Overview
          </div>
          <div
            className={`nav-item ${activeSection === 'debits' ? 'active' : ''}`}
            onClick={() => { setActiveSection('debits'); setSidebarOpen(false); }}
          >
            <span className="nav-icon">📒</span> My Debits
          </div>
          <div
            className={`nav-item ${activeSection === 'statement' ? 'active' : ''}`}
            onClick={() => { setActiveSection('statement'); setSidebarOpen(false); }}
          >
            <span className="nav-icon">📄</span> Account Statement
          </div>
        </nav>

        <div className="sidebar-footer">
          <div className="user-card">
            <div className="user-avatar">{myStudent.name[0].toUpperCase()}</div>
            <div className="user-info">
              <div className="user-name">{myStudent.name}</div>
              <div className="user-role">{myStudent.studentId}</div>
            </div>
          </div>
          <button className="btn btn-outline btn-full btn-sm" onClick={handleSignOut}>🚪 Sign Out</button>
        </div>
      </aside>

      {/* ── Main Content ── */}
      <main className="main-content">
        <div className="topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <button 
              className="btn btn-outline btn-sm hamburger-menu" 
              style={{ display: 'none' }} 
              onClick={() => setSidebarOpen(true)}
            >
              ☰
            </button>
            <div>
              <div className="topbar-title">
                {activeSection === 'overview' && 'Account Overview'}
                {activeSection === 'debits' && 'My Debits & Dues'}
                {activeSection === 'statement' && 'Account Statement'}
              </div>
              <div className="topbar-subtitle">
                {activeSection === 'overview' && 'Your financial summary'}
                {activeSection === 'debits' && 'Your pending charges'}
                {activeSection === 'statement' && 'Full transaction record'}
              </div>
            </div>
          </div>
        </div>

        <div className="page-content">
          {/* ── OVERVIEW SECTION ── */}
          {activeSection === 'overview' && (
            <div className="section active">
              <div className="balance-hero">
                <div className="balance-label">Outstanding Balance</div>
                <div
                  className="balance-amount"
                  style={{ color: totalOutstanding > 0 ? 'var(--danger)' : 'var(--success)' }}
                >
                  {fmt(totalOutstanding)}
                </div>
                <div 
                  className="balance-due"
                  style={{ color: totalOutstanding > 0 ? 'var(--danger)' : 'var(--success)' }}
                >
                  {totalOutstanding > 0
                    ? `You have ${fmt(totalOutstanding)} outstanding balance.`
                    : 'Your fees are fully paid!'}
                </div>
              </div>

              <div className="panel">
                <div className="panel-header">
                  <div className="panel-title">👤 My Profile</div>
                  <button className="btn btn-outline btn-sm" onClick={openEditProfileModal}>
                    ✏️ Edit Profile
                  </button>
                </div>
                <div className="panel-body">
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div style={{ padding: '.6rem 0', borderBottom: '1px solid var(--border)' }}>
                      <div style={{ fontSize: '.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: '.2rem' }}>
                        Student ID
                      </div>
                      <div style={{ fontSize: '.9rem', fontWeight: 500 }}>{myStudent.studentId}</div>
                    </div>
                    <div style={{ padding: '.6rem 0', borderBottom: '1px solid var(--border)' }}>
                      <div style={{ fontSize: '.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: '.2rem' }}>
                        Full Name
                      </div>
                      <div style={{ fontSize: '.9rem', fontWeight: 500 }}>{myStudent.name}</div>
                    </div>
                    <div style={{ padding: '.6rem 0', borderBottom: '1px solid var(--border)' }}>
                      <div style={{ fontSize: '.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: '.2rem' }}>
                        Batch
                      </div>
                      <div style={{ fontSize: '.9rem', fontWeight: 500 }}>{myStudent.batch || '—'}</div>
                    </div>
                    <div style={{ padding: '.6rem 0', borderBottom: '1px solid var(--border)' }}>
                      <div style={{ fontSize: '.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: '.2rem' }}>
                        Phone
                      </div>
                      <div style={{ fontSize: '.9rem', fontWeight: 500 }}>{myStudent.phone || '—'}</div>
                    </div>
                    <div style={{ padding: '.6rem 0', borderBottom: '1px solid var(--border)' }}>
                      <div style={{ fontSize: '.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: '.2rem' }}>
                        Enrolled
                      </div>
                      <div style={{ fontSize: '.9rem', fontWeight: 500 }}>{fmtDate(myStudent.createdAt)}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── DEBITS SECTION ── */}
          {activeSection === 'debits' && (
            <div className="section active">
              <div className="table-wrapper">
                <div className="table-header">
                  <div className="table-title">📒 My Debits & Dues</div>
                  <span className="badge badge-warning">Pending: {fmt(pendingDebitTotal)}</span>
                </div>
                <div style={{ overflowX: 'auto' }}>
                  {/* Desktop View */}
                  <table className="desktop-only">
                    <thead>
                      <tr>
                        <th>Description</th>
                        <th>Amount</th>
                        <th>Due Date</th>
                        <th>Status</th>
                        <th>Date Added</th>
                      </tr>
                    </thead>
                    <tbody>
                      {debits.length === 0 ? (
                        <tr>
                          <td colSpan="5">
                            <div className="empty-state">
                              <div className="empty-icon">📒</div>No debit entries for your account.
                            </div>
                          </td>
                        </tr>
                      ) : (
                        [...debits].reverse().map((d) => {
                          const badgeClass =
                            d.status === 'paid'
                              ? 'badge-success'
                              : d.status === 'partial'
                              ? 'badge-warning'
                              : 'badge-danger';
                          return (
                            <tr key={d.id}>
                              <td><strong>{d.description}</strong></td>
                              <td className={`${d.status === 'paid' ? 'text-success' : 'text-danger'} fw-bold`}>
                                {fmt(d.amount)}
                              </td>
                              <td className="td-muted">{fmtDate(d.dueDate)}</td>
                              <td><span className={`badge ${badgeClass}`}>{d.status}</span></td>
                              <td className="td-muted">{fmtDate(d.createdAt)}</td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>

                  {/* Mobile View */}
                  <div className="mobile-only">
                    {debits.length === 0 ? (
                      <div className="empty-state" style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                        <div className="empty-icon">📒</div>No debit entries for your account.
                      </div>
                    ) : (
                      <div className="statement-card-list" style={{ padding: 0 }}>
                        {[...debits].reverse().map((d) => {
                          const badgeClass =
                            d.status === 'paid'
                              ? 'badge-success'
                              : d.status === 'partial'
                              ? 'badge-warning'
                              : 'badge-danger';
                          return (
                            <div key={d.id} className="statement-card">
                              <div className="statement-card-header">
                                <span className="statement-card-student">{d.description}</span>
                                <span className={`badge ${badgeClass}`}>{d.status}</span>
                              </div>
                              <div className="statement-card-body">
                                <span className="statement-card-desc" style={{ fontSize: '0.75rem' }}>
                                  Due: {fmtDate(d.dueDate)} · Added: {fmtDate(d.createdAt)}
                                </span>
                                <span className="statement-card-amount" style={{ color: d.status === 'paid' ? 'var(--success)' : 'var(--danger)' }}>
                                  {fmt(d.amount)}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── STATEMENT SECTION ── */}
          {activeSection === 'statement' && (
            <div className="section active">
              <div className="panel">
                <div className="panel-header">
                  <div className="panel-title">📄 Account Statement</div>
                  <button className="btn btn-primary btn-sm" onClick={downloadMyStatement}>
                    ⬇ Download
                  </button>
                </div>
                <div className="panel-body">
                  <div style={{ marginBottom: '1.5rem' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', padding: '1rem', background: 'var(--bg-card)', borderRadius: 'var(--radius-sm)', marginBottom: '1rem' }}>
                      <div>
                        <div style={{ fontSize: '.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Fee</div>
                        <div style={{ fontSize: '1.2rem', fontWeight: 700 }}>{fmt(myStudent.totalFee)}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Amount Paid</div>
                        <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--success)' }}>{fmt(myStudent.paidAmount)}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Balance Due</div>
                        <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--danger)' }}>{fmt(myStudent.totalFee - myStudent.paidAmount)}</div>
                      </div>
                    </div>
                  </div>
                  <div style={{ overflowX: 'auto' }}>
                    {/* Desktop View */}
                    <table className="desktop-only">
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>Type</th>
                          <th>Description</th>
                          <th>Amount</th>
                          <th>Status</th>
                          <th>Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {statementRows.length === 0 ? (
                          <tr>
                            <td colSpan="6">
                              <div className="empty-state">No transactions yet.</div>
                            </td>
                          </tr>
                        ) : (
                          statementRows.map((r, i) => (
                            <tr key={i}>
                              <td className="td-muted">{i + 1}</td>
                              <td>
                                <span className={`badge ${r.credit ? 'badge-success' : 'badge-info'}`}>
                                  {r.type}
                                </span>
                              </td>
                              <td>{r.desc}</td>
                              <td className={`${r.credit ? 'text-success' : 'text-danger'} fw-bold`}>
                                {r.credit ? '+' : '-'}{fmt(r.amount)}
                              </td>
                              <td>
                                <span className={`badge ${r.status === 'completed' || r.status === 'paid' ? 'badge-success' : 'badge-warning'}`}>
                                  {r.status}
                                </span>
                              </td>
                              <td className="td-muted">{fmtDate(r.date)}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>

                    {/* Mobile View */}
                    <div className="mobile-only">
                      {statementRows.length === 0 ? (
                        <div className="empty-state" style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>No transactions yet.</div>
                      ) : (
                        <div className="statement-card-list" style={{ padding: 0 }}>
                          {statementRows.map((r, i) => (
                            <div key={i} className="statement-card">
                              <div className="statement-card-header">
                                <span className="statement-card-student" style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>#{i + 1} · {fmtDate(r.date)}</span>
                                <span className={`badge ${r.credit ? 'badge-success' : 'badge-info'}`}>{r.type}</span>
                              </div>
                              <div className="statement-card-body">
                                <span className="statement-card-desc">{r.desc}</span>
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.2rem' }}>
                                  <span className={`${r.credit ? 'text-success' : 'text-danger'} fw-bold`} style={{ fontSize: '0.9rem' }}>
                                    {r.credit ? '+' : '-'}{fmt(r.amount)}
                                  </span>
                                  <span className={`badge ${r.status === 'completed' || r.status === 'paid' ? 'badge-success' : 'badge-warning'}`} style={{ transform: 'scale(0.85)', transformOrigin: 'right' }}>
                                    {r.status}
                                  </span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* ── Edit Profile Modal ── */}
      {isEditModalOpen && (
        <div className="modal-overlay open" onClick={(e) => e.target === e.currentTarget && setIsEditModalOpen(false)}>
          <div className="modal w-full max-w-md mx-auto">
            <div className="modal-header">
              <div className="modal-title">✏️ Edit Profile</div>
              <button className="modal-close" onClick={() => setIsEditModalOpen(false)}>✕</button>
            </div>
            <div className="modal-body p-5 lg:p-6">
              <form onSubmit={handleEditProfileSubmit}>
                <div className="form-group">
                  <label htmlFor="ep-name">Full Name *</label>
                  <input
                    className="form-control"
                    id="ep-name"
                    required
                    placeholder="Full Name"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="ep-phone">Phone Number *</label>
                  <input
                    className="form-control"
                    id="ep-phone"
                    required
                    placeholder="Phone Number"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                  />
                </div>
                {editAlert && (
                  <div className={`alert alert-${editAlert.type === 'error' ? 'error' : 'success'}`}>
                    {editAlert.text}
                  </div>
                )}
                <div className="modal-footer" style={{ padding: 0, marginTop: '1rem' }}>
                  <button className="btn btn-outline" type="button" onClick={() => setIsEditModalOpen(false)}>
                    Cancel
                  </button>
                  <button className="btn btn-primary" type="submit" disabled={modalLoading}>
                    {modalLoading ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
