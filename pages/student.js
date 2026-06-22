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
    if (storedId) storedId = storedId.toLowerCase();
    const user = getCurrentUser();
    if (!storedId) {
      if (user && user.role === 'student') {
        storedId = user.username.toLowerCase();
        localStorage.setItem('student_id', storedId);
      } else {
        document.cookie = 'lab_role=; path=/; max-age=0; SameSite=Lax';
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

  const generatePDF = (jspdfLib) => {
    const { jsPDF } = jspdfLib;
    const doc = new jsPDF();
    
    // Page dimensions
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;
    
    const fmtPDF = (n) => 'Rs. ' + Number(n || 0).toLocaleString('en-IN');

    // Visual Accent Bar (Navy Blue)
    doc.setFillColor(30, 58, 138);
    doc.rect(15, 18, 4, 16, 'F');

    // Header
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.setTextColor(15, 23, 42); // Dark slate
    doc.text("AMAN COMPUTER LAB", 22, 25);
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139); // Slate-500
    doc.text("Student Account Statement", 22, 31);
    
    const todayStr = new Date().toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
    doc.text(`Generated: ${todayStr}`, pageWidth - 15, 31, { align: 'right' });
    
    // Separator line
    doc.setDrawColor(226, 232, 240); // Slate-200
    doc.setLineWidth(0.5);
    doc.line(15, 37, pageWidth - 15, 37);
    
    // Student Info Box
    doc.setFillColor(248, 250, 252); // Slate-50
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(15, 42, pageWidth - 30, 26, 3, 3, 'FD');
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(30, 58, 138); // Slate-600
    doc.text("STUDENT INFORMATION", 20, 48);
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(15, 23, 42);
    
    doc.text(`Name:`, 20, 54);
    doc.setFont("helvetica", "bold");
    doc.text(myStudent.name, 45, 54);
    
    doc.setFont("helvetica", "normal");
    doc.text(`Student ID:`, 20, 61);
    doc.setFont("helvetica", "bold");
    doc.text(myStudent.studentId.toLowerCase(), 45, 61);
    
    doc.setFont("helvetica", "normal");
    doc.text(`Batch:`, 110, 54);
    doc.setFont("helvetica", "bold");
    doc.text(myStudent.batch || '—', 130, 54);
    
    doc.setFont("helvetica", "normal");
    doc.text(`Phone:`, 110, 61);
    doc.setFont("helvetica", "bold");
    doc.text(myStudent.phone || '—', 130, 61);
    
    // Financial Summary
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(15, 73, pageWidth - 30, 20, 3, 3, 'FD');
    
    const colW = (pageWidth - 30) / 3;
    
    // Total Fee
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text("TOTAL FEE", 15 + colW / 2, 79, { align: 'center' });
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text(fmtPDF(myStudent.totalFee), 15 + colW / 2, 87, { align: 'center' });
    
    // Paid Amount
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text("AMOUNT PAID", 15 + colW + colW / 2, 79, { align: 'center' });
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(16, 185, 129); // emerald-500
    doc.text(fmtPDF(myStudent.paidAmount), 15 + colW + colW / 2, 87, { align: 'center' });
    
    // Balance Due
    const balDue = myStudent.totalFee - myStudent.paidAmount;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text("BALANCE DUE", 15 + colW * 2 + colW / 2, 79, { align: 'center' });
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(balDue > 0 ? 239 : 16, balDue > 0 ? 68 : 185, balDue > 0 ? 68 : 129); // red or emerald
    doc.text(fmtPDF(balDue), 15 + colW * 2 + colW / 2, 87, { align: 'center' });
    
    // Segment dividers
    doc.setDrawColor(226, 232, 240);
    doc.line(15 + colW, 73, 15 + colW, 93);
    doc.line(15 + colW * 2, 73, 15 + colW * 2, 93);
    
    // Statement Table Label
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(30, 58, 138);
    doc.text("TRANSACTION LEDGER", 15, 102);
    
    // Table Header
    doc.setFillColor(30, 41, 59); // slate-800
    doc.rect(15, 106, pageWidth - 30, 10, 'F');
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(255, 255, 255);
    doc.text("#", 18, 112.5);
    doc.text("Date", 26, 112.5);
    doc.text("Type", 51, 112.5);
    doc.text("Description", 76, 112.5);
    doc.text("Amount", 160, 112.5, { align: 'right' });
    doc.text("Status", 175, 112.5);
    
    // Table Rows
    let y = 116;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    
    statementRows.forEach((r, idx) => {
      // Check page overflow
      if (y > pageHeight - 25) {
        doc.addPage();
        y = 20;
        // Redraw table headers on new page
        doc.setFillColor(30, 41, 59);
        doc.rect(15, y, pageWidth - 30, 10, 'F');
        doc.setFont("helvetica", "bold");
        doc.setTextColor(255, 255, 255);
        doc.text("#", 18, y + 6.5);
        doc.text("Date", 26, y + 6.5);
        doc.text("Type", 51, y + 6.5);
        doc.text("Description", 76, y + 6.5);
        doc.text("Amount", 160, y + 6.5, { align: 'right' });
        doc.text("Status", 175, y + 6.5);
        
        y += 10;
        doc.setFont("helvetica", "normal");
      }
      
      // Row background
      if (idx % 2 === 0) {
        doc.setFillColor(248, 250, 252);
        doc.rect(15, y, pageWidth - 30, 10, 'F');
      } else {
        doc.setFillColor(255, 255, 255);
        doc.rect(15, y, pageWidth - 30, 10, 'F');
      }
      
      doc.setTextColor(100, 116, 139);
      doc.text(String(idx + 1), 18, y + 6.5);
      doc.text(fmtDate(r.date), 26, y + 6.5);
      
      doc.setFont("helvetica", "bold");
      // Color badge for type
      if (r.credit) {
        doc.setTextColor(16, 185, 129); // green
      } else {
        doc.setTextColor(59, 130, 246); // blue
      }
      doc.text(r.type, 51, y + 6.5);
      
      doc.setFont("helvetica", "normal");
      doc.setTextColor(15, 23, 42);
      // Truncate description if too long
      let desc = r.desc || '';
      if (desc.length > 38) desc = desc.slice(0, 35) + '...';
      doc.text(desc, 76, y + 6.5);
      
      doc.setFont("helvetica", "bold");
      if (r.credit) {
        doc.setTextColor(16, 185, 129);
      } else {
        doc.setTextColor(239, 68, 68);
      }
      const sign = r.credit ? '+' : '-';
      doc.text(`${sign}${fmtPDF(r.amount)}`, 160, y + 6.5, { align: 'right' });
      
      doc.setFont("helvetica", "bold");
      if (r.status === 'completed' || r.status === 'paid') {
        doc.setTextColor(16, 185, 129);
      } else {
        doc.setTextColor(245, 158, 11);
      }
      doc.text(r.status.toUpperCase(), 175, y + 6.5);
      
      // Bottom border for row
      doc.setDrawColor(241, 245, 249);
      doc.line(15, y + 10, pageWidth - 15, y + 10);
      
      y += 10;
    });
    
    // Add document footer
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184); // slate-400
    doc.text("This is a computer generated document and does not require a physical signature.", pageWidth / 2, pageHeight - 12, { align: 'center' });
    doc.text("Aman Computer Lab · All Rights Reserved", pageWidth / 2, pageHeight - 8, { align: 'center' });
    
    doc.save(`Statement_${myStudent.studentId}.pdf`);
    addToast('Statement PDF downloaded!', 'success');
  };

  const downloadMyStatement = () => {
    if (!myStudent) return;
    addToast('Generating statement PDF...', 'info');

    if (window.jspdf) {
      generatePDF(window.jspdf);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
    script.onload = () => {
      generatePDF(window.jspdf);
    };
    script.onerror = () => {
      addToast('Failed to load PDF generator. Please try again.', 'error');
    };
    document.body.appendChild(script);
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
                  <div className="profile-info-grid">
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
                    <div className="statement-summary-grid" style={{ padding: '1rem', background: 'var(--bg-card)', borderRadius: 'var(--radius-sm)', marginBottom: '1rem' }}>
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
