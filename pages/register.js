import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { seedDefaults, createStudent, getCurrentUser, loginUser } from '../js/storage.service';

export default function Register() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [studentId, setStudentId] = useState('');
  const [batch, setBatch] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [strength, setStrength] = useState({ pct: '0%', color: '', text: '' });
  const [alertMsg, setAlertMsg] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    seedDefaults();
    const savedStudentId = localStorage.getItem('student_id');
    const user = getCurrentUser();
    if (savedStudentId || (user && user.role === 'student')) {
      router.replace('/student');
    }
  }, [router]);

  const toTitleCase = (str) => {
    if (!str) return '';
    return str
      .split(' ')
      .map((word) => {
        if (!word) return '';
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
      })
      .join(' ');
  };

  const handleNameChange = (e) => {
    const val = e.target.value;
    setName(toTitleCase(val));
  };

  const checkStrength = (val) => {
    let score = 0;
    if (val.length >= 6) score++;
    if (val.length >= 10) score++;
    if (/[A-Z]/.test(val)) score++;
    if (/[0-9]/.test(val)) score++;
    if (/[^A-Za-z0-9]/.test(val)) score++;

    const levels = [
      { pct: '0%', color: '', text: '' },
      { pct: '25%', color: 'var(--danger)', text: '🔴 Weak' },
      { pct: '50%', color: 'var(--warning)', text: '🟡 Fair' },
      { pct: '75%', color: 'var(--info)', text: '🔵 Good' },
      { pct: '90%', color: 'var(--success)', text: '🟢 Strong' },
      { pct: '100%', color: 'var(--accent-2)', text: '✨ Very Strong' },
    ];
    setStrength(levels[Math.min(score, 5)]);
  };

  const handlePasswordChange = (e) => {
    const val = e.target.value;
    setPassword(val);
    checkStrength(val);
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setAlertMsg(null);

    // Client-side validation
    if (!name.trim()) {
      setAlertMsg({ type: 'error', text: '⚠️ Please enter your full name.' });
      return;
    }
    if (!studentId.trim()) {
      setAlertMsg({ type: 'error', text: '⚠️ Please enter your Student ID.' });
      return;
    }
    if (!batch) {
      setAlertMsg({ type: 'error', text: '⚠️ Please select your batch.' });
      return;
    }
    if (!phone.trim()) {
      setAlertMsg({ type: 'error', text: '⚠️ Please enter your phone number.' });
      return;
    }
    if (password.length < 6) {
      setAlertMsg({ type: 'error', text: '⚠️ Password must be at least 6 characters.' });
      return;
    }
    if (password !== confirmPassword) {
      setAlertMsg({ type: 'error', text: '⚠️ Passwords do not match.' });
      return;
    }

    setLoading(true);

    const { data, error } = await createStudent({
      name: name.trim(),
      studentId: studentId.trim().toLowerCase(),
      batch,
      phone: phone.trim(),
      password,
    });

    if (error) {
      setAlertMsg({ type: 'error', text: `⚠️ ${error}` });
      setLoading(false);
      return;
    }

    // Auto-login after successful registration
    const loginRes = await loginUser(studentId.trim().toLowerCase(), password);
    if (loginRes.error) {
      setAlertMsg({ type: 'success', text: '✅ Registration successful! Redirecting to login...' });
      setTimeout(() => {
        router.replace('/login');
      }, 2000);
      return;
    }

    if (loginRes.data.role === 'student') {
      localStorage.setItem('student_id', loginRes.data.username);
    }
    
    // Prefill login session info for future sessions
    localStorage.setItem('saved_student_id', studentId.trim().toLowerCase());
    localStorage.setItem('saved_student_pwd', password);
    localStorage.setItem('auto_login_student', 'true');

    setAlertMsg({ type: 'success', text: '✅ Registration successful! Logging you in...' });
    setTimeout(() => {
      router.replace('/student');
    }, 1500);
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <Link href="/login" className="back-link">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="19" y1="12" x2="5" y2="12"></line>
            <polyline points="12 19 5 12 12 5"></polyline>
          </svg>
          <span>Back to Login</span>
        </Link>

        <div className="auth-logo">
          <div className="logo-icon">🎓</div>
          <h1>Student Registration</h1>
          <p>Create your Lab Accounts profile</p>
        </div>

        <form onSubmit={handleRegister}>
          <div className="form-group">
            <label htmlFor="name">Full Name <span style={{ color: 'var(--danger)' }}>*</span></label>
            <input
              id="name"
              className="form-control capitalize-input"
              type="text"
              placeholder="e.g. Anfaz Ahamed"
              value={name}
              onChange={handleNameChange}
              required
              autoComplete="name"
            />
          </div>

          <div className="form-group">
            <label htmlFor="studentId">Student ID <span style={{ color: 'var(--danger)' }}>*</span></label>
            <input
              id="studentId"
              className="form-control"
              type="text"
              placeholder="e.g. 2024cs001"
              value={studentId}
              onChange={(e) => setStudentId(e.target.value.toLowerCase())}
              required
            />
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>
              This will be your login ID. Choose it carefully.
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="batch">Batch <span style={{ color: 'var(--danger)' }}>*</span></label>
            <input
              id="batch"
              className="form-control"
              list="batch-list"
              placeholder="Select or type your batch..."
              value={batch}
              onChange={(e) => setBatch(e.target.value)}
              required
            />
            <datalist id="batch-list">
              <option value="HS1" />
              <option value="HS2" />
              <option value="BS1" />
              <option value="BS2" />
              <option value="BS3" />
              <option value="BS4" />
              <option value="BS5" />
            </datalist>
          </div>

          <div className="form-group">
            <label htmlFor="phone">Phone <span style={{ color: 'var(--danger)' }}>*</span></label>
            <input
              id="phone"
              className="form-control"
              type="tel"
              placeholder="e.g. +91 9876543210"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password <span style={{ color: 'var(--danger)' }}>*</span></label>
            <div className="password-wrapper">
              <input
                id="password"
                className="form-control"
                type={showPassword ? 'text' : 'password'}
                placeholder="Create a strong password"
                value={password}
                onChange={handlePasswordChange}
                required
                minLength={6}
              />
              <button
                type="button"
                className="eye-btn"
                onClick={() => setShowPassword(!showPassword)}
                title="Show/Hide"
              >
                👁️
              </button>
            </div>
            <div className="strength-bar">
              <div
                className="strength-fill"
                style={{ width: strength.pct, background: strength.color }}
              />
            </div>
            <div className="strength-label">{strength.text}</div>
          </div>

          <div className="form-group">
            <label htmlFor="confirm-password">Confirm Password <span style={{ color: 'var(--danger)' }}>*</span></label>
            <div className="password-wrapper">
              <input
                id="confirm-password"
                className="form-control"
                type={showConfirmPassword ? 'text' : 'password'}
                placeholder="Re-enter your password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
              <button
                type="button"
                className="eye-btn"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                title="Show/Hide"
              >
                👁️
              </button>
            </div>
          </div>

          {alertMsg && (
            <div className={`alert alert-${alertMsg.type === 'error' ? 'error' : 'success'}`}>
              {alertMsg.text}
            </div>
          )}

          <button className="btn btn-primary btn-full" type="submit" disabled={loading}>
            <span>{loading ? 'Creating account...' : '✅ Create Account'}</span>
          </button>
        </form>

        <p style={{ textAlign: 'center', fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '1.5rem' }}>
          Already registered?{' '}
          <Link href="/login" className="text-accent hover:underline">
            Sign In
          </Link>
        </p>
      </div>
    </div>
  );
}
