import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { seedDefaults, loginUser, getCurrentUser } from '../js/storage.service';

export default function Login() {
  const router = useRouter();
  const [role, setRole] = useState('student');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [logoClicks, setLogoClicks] = useState(0);
  const [adminUnlocked, setAdminUnlocked] = useState(false);
  const [alertMsg, setAlertMsg] = useState(null);
  const [loading, setLoading] = useState(false);
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    seedDefaults();
    const currentUser = getCurrentUser();
    if (currentUser) {
      if (currentUser.role === 'admin') {
        router.replace('/admin');
      } else {
        router.replace('/student');
      }
    }
  }, [router]);

  const addToast = (msg, type = 'info') => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, msg, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  };

  const handleLogoClick = () => {
    const nextClicks = logoClicks + 1;
    setLogoClicks(nextClicks);
    if (!adminUnlocked && nextClicks >= 5) {
      setAdminUnlocked(true);
      addToast('🛡️ Admin access unlocked', 'info');
    }
  };

  const switchRole = (newRole) => {
    setRole(newRole);
    setAlertMsg(null);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setAlertMsg(null);

    const { data, error } = await loginUser(username.trim(), password);

    if (error) {
      setAlertMsg({ type: 'error', text: `⚠️ ${error}` });
      setLoading(false);
      return;
    }

    if (data.role !== role) {
      const label = role === 'admin' ? 'an Admin' : 'a Student';
      setAlertMsg({ type: 'error', text: `⚠️ This account is not registered as ${label}.` });
      setLoading(false);
      return;
    }

    if (data.role === 'student') {
      localStorage.setItem('student_id', data.username);
    }

    addToast('🔑 Login successful!', 'success');
    setTimeout(() => {
      router.push(data.role === 'admin' ? '/admin' : '/student');
    }, 500);
  };

  return (
    <div className="auth-page">
      <div className="toast-container">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.type}`}>
            {t.msg}
          </div>
        ))}
      </div>

      <div className="auth-card">
        <div className="auth-logo">
          <div
            className={`logo-icon ${adminUnlocked ? 'unlocked' : ''}`}
            onClick={handleLogoClick}
            style={{ cursor: 'pointer' }}
            title={adminUnlocked ? 'Admin access unlocked' : 'Lab Accounts'}
          >
            🧪
          </div>
          <h1>Lab Accounts</h1>
          <p>{role === 'admin' ? 'Administrator Portal' : 'Student Portal'}</p>
        </div>

        {adminUnlocked && (
          <div className="role-tabs" style={{ display: 'flex' }}>
            <button
              className={`role-tab ${role === 'student' ? 'active' : ''}`}
              onClick={() => switchRole('student')}
            >
              🎓 Student
            </button>
            <button
              className={`role-tab ${role === 'admin' ? 'active' : ''}`}
              onClick={() => switchRole('admin')}
            >
              🛡️ Admin
            </button>
          </div>
        )}

        {alertMsg && (
          <div className={`alert alert-${alertMsg.type === 'error' ? 'error' : 'success'}`}>
            {alertMsg.text}
          </div>
        )}

        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label htmlFor="username">{role === 'admin' ? 'Username' : 'Student ID'}</label>
            <input
              id="username"
              className="form-control"
              type="text"
              placeholder={role === 'admin' ? 'Enter admin username' : 'Enter your Student ID'}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoComplete="username"
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <div className="password-wrapper">
              <input
                id="password"
                className="form-control"
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
              <button
                type="button"
                className="eye-btn"
                onClick={() => setShowPassword(!showPassword)}
                title="Show/Hide password"
              >
                {showPassword ? '🙈' : '👁️'}
              </button>
            </div>
          </div>

          <button className="btn btn-primary btn-full" type="submit" disabled={loading}>
            <span>{loading ? 'Signing in...' : 'Sign In'}</span>
          </button>
        </form>

        {role === 'student' && (
          <div className="register-link">
            New student?{' '}
            <Link href="/register" legacyBehavior>
              <a>Create an Account →</a>
            </Link>
          </div>
        )}

        <p className="version">Lab Accounts v1.0</p>
      </div>
    </div>
  );
}
