import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { seedDefaults, loginUser, getCurrentUser } from '../js/storage.service';

export default function Login() {
  const router = useRouter();
  const [role, setRole] = useState('student');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [studentName, setStudentName] = useState('');
  const cardRef = useRef(null);

  // Website theme tokens
  const t = {
    bgPrimary:   '#0a0f1e',
    bgSecondary: '#0d1526',
    bgCard:      'rgba(255,255,255,0.05)',
    border:      'rgba(255,255,255,0.1)',
    accent:      '#6c63ff',
    accent2:     '#a78bfa',
    textPrimary: '#f1f5f9',
    textSecondary:'#94a3b8',
    textMuted:   '#475569',
    danger:      '#ef4444',
  };

  useEffect(() => {
    seedDefaults();
    const currentUser = getCurrentUser();
    if (currentUser) {
      router.replace(currentUser.role === 'admin' ? '/' : '/student');
      return;
    }

    // Prefill saved credentials based on last role (defaulting to student)
    const hasStudent = !!localStorage.getItem('saved_student_id');
    const hasAdmin = !!localStorage.getItem('saved_admin_id');
    const lastRole = hasStudent ? 'student' : hasAdmin ? 'admin' : 'student';

    const savedId = localStorage.getItem(`saved_${lastRole}_id`) || '';
    const savedPwd = localStorage.getItem(`saved_${lastRole}_pwd`) || '';
    const autoLogin = localStorage.getItem(`auto_login_${lastRole}`);

    if (savedId) {
      setIdentifier(savedId);
      setPassword(savedPwd);
      setRememberMe(true);
      setRole(lastRole);

      if (autoLogin === 'true' && savedPwd) {
        setLoading(true);
        loginUser(savedId, savedPwd).then(({ data, error }) => {
          if (!error && data && data.role === lastRole) {
            if (data.role === 'student') localStorage.setItem('student_id', data.username);
            router.push(data.role === 'admin' ? '/' : '/student');
          } else {
            setLoading(false);
            if (error) setErrorMsg(error);
          }
        });
      }
    }
  }, [router]);

  useEffect(() => {
    const card = cardRef.current;
    if (!card) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          card.classList.add('card-visible');
          observer.disconnect();
        }
      },
      { threshold: 0.15 }
    );
    observer.observe(card);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (showForgotModal) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [showForgotModal]);



  const handleLogoClick = () => {
    const nextRole = role === 'student' ? 'admin' : 'student';
    setRole(nextRole);
    setErrorMsg('');
    const savedId = localStorage.getItem(`saved_${nextRole}_id`) || '';
    const savedPwd = localStorage.getItem(`saved_${nextRole}_pwd`) || '';
    setIdentifier(savedId);
    setPassword(savedPwd);
    setRememberMe(!!savedId || nextRole === 'student');
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);

    const { data, error } = await loginUser(identifier.trim().toLowerCase(), password);

    if (error) { setErrorMsg(error); setLoading(false); return; }
    if (data.role !== role) {
      setErrorMsg(`This account is not registered as ${role === 'admin' ? 'an Admin' : 'a Student'}.`);
      setLoading(false); return;
    }
    if (data.role === 'student') localStorage.setItem('student_id', data.username);

    // Auto-save ID and password logic
    if (rememberMe) {
      localStorage.setItem(`saved_${role}_id`, identifier.trim().toLowerCase());
      localStorage.setItem(`saved_${role}_pwd`, password);
      localStorage.setItem(`auto_login_${role}`, 'true');
    } else {
      localStorage.removeItem(`saved_${role}_id`);
      localStorage.removeItem(`saved_${role}_pwd`);
      localStorage.removeItem(`auto_login_${role}`);
    }

    router.push(data.role === 'admin' ? '/' : '/student');
  };

  const inputStyle = (focused) => ({
    width: '100%', boxSizing: 'border-box',
    padding: '12px 14px 12px 40px',
    background: 'rgba(255,255,255,0.05)',
    border: `1px solid ${focused ? t.accent : t.border}`,
    borderRadius: 10,
    color: t.textPrimary,
    fontSize: 14, outline: 'none',
    transition: 'border-color 0.2s, background 0.2s',
    fontFamily: 'inherit',
  });

  return (
    <div style={{
      minHeight: '100vh', width: '100%',
      position: 'relative',
      display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
      fontFamily: "'Inter', 'Segoe UI', sans-serif",
    }} className="login-wrapper">

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Inter', 'Segoe UI', sans-serif; }

        @media (max-width: 768px) {
          .login-wrapper {
            justify-content: flex-start !important;
            align-items: center !important;
            flex-direction: column !important;
            padding: 0 !important;
            overflow-y: auto !important;
            min-height: 100vh;
          }
          .login-card {
            margin: 0 16px 40px !important;
            padding: 28px 20px !important;
            width: calc(100% - 32px) !important;
            max-width: 420px !important;
            border-radius: 20px !important;
            align-self: center !important;
          }
          .login-logo        { display: none !important; }
          .login-testimonial { display: none !important; }
          .mobile-hero       { display: flex !important; }
        }
        @media (min-width: 769px) {
          .mobile-hero { display: none !important; }
        }
        @media (min-width: 769px) and (max-width: 1024px) {
          .login-wrapper { justify-content: center !important; }
          .login-card    { margin: 24px !important; }
          .login-logo    { display: flex !important; }
          .login-testimonial { display: none !important; }
        }
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(18px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .mobile-hero > * { animation: fadeSlideUp 0.55s ease both; }
        .mobile-hero > *:nth-child(2) { animation-delay: 0.1s; }
        .mobile-hero > *:nth-child(3) { animation-delay: 0.2s; }
        .mobile-hero > *:nth-child(4) { animation-delay: 0.3s; }
        .mobile-hero > *:nth-child(5) { animation-delay: 0.42s; }
        @keyframes slideInRight {
          from { opacity: 0; transform: translateX(60px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @media (max-width: 768px) {
          .login-card {
            opacity: 0;
            transform: translateX(60px);
            transition: none;
          }
          .login-card.card-visible {
            animation: slideInRight 0.5s cubic-bezier(0.22, 1, 0.36, 1) forwards;
          }
        }
        @keyframes bounce {
          0%, 100% { transform: translateY(0); }
          50%       { transform: translateY(7px); }
        }
        .scroll-hint { animation: bounce 1.8s ease-in-out infinite; }

        /* Forgot password modal mobile fix */
        @media (max-width: 480px) {
          .forgot-modal-inner {
            padding: 24px 18px 20px !important;
          }
        }
      `}</style>

      {/* ── Background Image ── */}
      <div style={{
        position: 'absolute', inset: 0, zIndex: 0,
        backgroundImage: "url('https://img.magnific.com/free-photo/vacant-modern-workspace-with-computers_482257-127194.jpg')",
        backgroundSize: 'cover', backgroundPosition: 'center',
      }} />
      {/* ── Dark overlay ── */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 1, background: 'rgba(10,15,30,0.82)' }} />

      {/* ── Mobile Hero (name + quote + scroll hint) ── */}
      <div className="mobile-hero" style={{
        display: 'none', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', textAlign: 'center',
        padding: '72px 28px 44px', width: '100%',
        position: 'relative', zIndex: 10, minHeight: '100vh',
      }}>
        <div 
          onClick={handleLogoClick}
          style={{
            width: 68, height: 68, borderRadius: 20, marginBottom: 20,
            background: 'linear-gradient(135deg, #6c63ff, #a78bfa)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 36px rgba(108,99,255,0.55)',
            cursor: 'pointer',
            userSelect: 'none'
          }}
        >
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="3" width="20" height="14" rx="2"/>
            <line x1="8" y1="21" x2="16" y2="21"/>
            <line x1="12" y1="17" x2="12" y2="21"/>
          </svg>
        </div>
 
        <h1 style={{ fontSize: 28, fontWeight: 800, color: '#f1f5f9', marginBottom: 8, letterSpacing: '-0.5px' }}>
          Aman Computer Lab
        </h1>
 
        <p style={{ fontSize: 15, color: 'rgba(167,139,250,0.9)', fontWeight: 500, lineHeight: 1.75, maxWidth: 300, marginBottom: 6 }}>
          "Digital skills empower every student to build, create, and innovate in today's world."
        </p>
 
        <p style={{ fontSize: 12, color: 'rgba(148,163,184,0.6)', marginBottom: 36, fontStyle: 'italic' }}>
          — Aman Computer Lab
        </p>
 
        <div className="scroll-hint" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          <p style={{ fontSize: 12, color: 'rgba(148,163,184,0.55)', fontWeight: 500, letterSpacing: '0.04em' }}>SCROLL TO SIGN IN</p>
          <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="rgba(108,99,255,0.7)" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>
 
      {/* ── Logo top-left ── */}
      <div className="login-logo" style={{ position: 'absolute', top: 32, left: 40, zIndex: 10, display: 'flex', alignItems: 'center', gap: 12 }}>
        <div 
          onClick={handleLogoClick}
          style={{
            width: 38, height: 38, borderRadius: 10,
            background: 'linear-gradient(135deg, #6c63ff, #a78bfa)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 20px rgba(108,99,255,0.45)',
            cursor: 'pointer',
            userSelect: 'none'
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="3" width="20" height="14" rx="2"/>
            <line x1="8" y1="21" x2="16" y2="21"/>
            <line x1="12" y1="17" x2="12" y2="21"/>
          </svg>
        </div>
        <span style={{ color: t.textPrimary, fontWeight: 700, fontSize: 17, letterSpacing: '-0.3px' }}>Aman Computer Lab</span>
      </div>

      {/* ── Testimonial bottom-left ── */}
      <div className="login-testimonial" style={{ position: 'absolute', bottom: 44, left: 48, zIndex: 10, color: t.textPrimary, maxWidth: 440 }}>
        <svg style={{ width: 30, height: 30, color: t.accent2, marginBottom: 12, opacity: 0.8 }} fill="currentColor" viewBox="0 0 32 32">
          <path d="M10 8c-3.3 0-6 2.7-6 6v10h10V14H8c0-1.1.9-2 2-2h4V8h-4zm14 0c-3.3 0-6 2.7-6 6v10h10V14h-6c0-1.1.9-2 2-2h4V8h-4z" />
        </svg>
        <p style={{ fontSize: 18, fontWeight: 500, lineHeight: 1.65, marginBottom: 18, color: t.textSecondary }}>
          "Studying computers opens doors to endless opportunities. Digital skills empower every student to build, create, and innovate."
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'linear-gradient(135deg,#6c63ff,#a78bfa)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>🎓</div>
          <div>
            <p style={{ fontWeight: 700, fontSize: 14, color: t.textPrimary, marginBottom: 2 }}>Benefits of Computer Education</p>
            <p style={{ color: t.accent2, fontSize: 13, fontWeight: 500 }}>Aman Computer Lab — Empowering Students</p>
          </div>
        </div>
      </div>

      {/* ── Login Card ── */}
      <div ref={cardRef} className="login-card" style={{
        position: 'relative', zIndex: 10,
        width: '100%', maxWidth: 440,
        background: 'rgba(13,21,38,0.92)',
        backdropFilter: 'blur(20px)',
        border: `1px solid ${t.border}`,
        borderRadius: 18,
        boxShadow: '0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(108,99,255,0.12)',
        padding: '36px 36px 28px',
        margin: '24px 72px 24px 0',
      }}>

        {/* Header */}
        <div style={{ marginBottom: 20 }}>
          <div 
            onClick={handleLogoClick}
            style={{
              width: 48, height: 48, borderRadius: 14, marginBottom: 14,
              background: 'linear-gradient(135deg, #6c63ff, #a78bfa)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 0 24px rgba(108,99,255,0.4)',
              cursor: 'pointer',
              userSelect: 'none'
            }}
            title="Switch login mode"
          >
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="3" width="20" height="14" rx="2"/>
              <line x1="8" y1="21" x2="16" y2="21"/>
              <line x1="12" y1="17" x2="12" y2="21"/>
            </svg>
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#f1f5f9', marginBottom: 4, letterSpacing: '-0.5px', fontFamily: "'Syne', sans-serif" }}>
            {role === 'admin' ? 'Admin Gateway' : 'Hi there, great to see you'}
          </h1>
          <p style={{ color: t.textSecondary, fontWeight: 500, fontSize: 14 }}>
            {role === 'admin' ? 'Sign in to the Admin Dashboard.' : 'Welcome back! Sign in to your student account.'}
          </p>
        </div>

        {/* Role Tabs - Hidden */}
        <div style={{
          display: 'none', gap: 5,
          background: 'rgba(255,255,255,0.04)',
          border: `1px solid ${t.border}`,
          borderRadius: 10, padding: 4, marginBottom: 20,
        }}>
          {['student','admin'].map(r => (
            <button key={r} type="button"
              onClick={() => { 
                setRole(r); 
                setErrorMsg(''); 
                const savedId = localStorage.getItem(`saved_${r}_id`) || '';
                const savedPwd = localStorage.getItem(`saved_${r}_pwd`) || '';
                setIdentifier(savedId);
                setPassword(savedPwd);
                setRememberMe(!!savedId || r === 'student');
              }}
              style={{
                flex: 1, padding: '8px 0', border: 'none', borderRadius: 7,
                fontWeight: 600, fontSize: 13, cursor: 'pointer',
                fontFamily: 'inherit',
                background: role === r
                  ? 'linear-gradient(135deg, #6c63ff, #a78bfa)'
                  : 'transparent',
                color: role === r ? '#fff' : t.textSecondary,
                boxShadow: role === r ? '0 4px 12px rgba(108,99,255,0.35)' : 'none',
                transition: 'all 0.2s',
              }}
            >
              {r === 'student' ? '🎓 Student' : '🛡️ Admin'}
            </button>
          ))}
        </div>

        {/* Error */}
        {errorMsg && (
          <div style={{
            padding: '10px 14px', marginBottom: 14, borderRadius: 8,
            background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
            color: '#fca5a5', fontSize: 13, fontWeight: 500,
          }}>⚠️ {errorMsg}</div>
        )}

        <form onSubmit={handleLogin}>

          {/* Identifier */}
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: t.textSecondary, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {role === 'admin' ? 'Username' : 'Student ID'}
            </label>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: t.textMuted, pointerEvents: 'none' }}>
                {role === 'admin' ? (
                  <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" /></svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor"><path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z"/><path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z"/></svg>
                )}
              </span>
              <input
                id="identifier" type="text"
                placeholder={role === 'admin' ? 'Enter admin username' : 'Enter your Student ID'}
                value={identifier} onChange={e => setIdentifier(role === 'student' ? e.target.value.toLowerCase() : e.target.value)} required
                style={inputStyle(false)}
                onFocus={e => { e.target.style.borderColor = t.accent; e.target.style.background = 'rgba(108,99,255,0.08)'; }}
                onBlur={e => { e.target.style.borderColor = t.border; e.target.style.background = 'rgba(255,255,255,0.05)'; }}
              />
            </div>
          </div>

          {/* Password */}
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: t.textSecondary, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Password
            </label>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: t.textMuted, pointerEvents: 'none' }}>
                <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd"/></svg>
              </span>
              <input
                id="password" type={showPassword ? 'text' : 'password'}
                placeholder="Enter your password"
                value={password} onChange={e => setPassword(e.target.value)} required
                style={{ ...inputStyle(false), paddingRight: 44 }}
                onFocus={e => { e.target.style.borderColor = t.accent; e.target.style.background = 'rgba(108,99,255,0.08)'; }}
                onBlur={e => { e.target.style.borderColor = t.border; e.target.style.background = 'rgba(255,255,255,0.05)'; }}
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)}
                style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: t.textMuted, padding: 4, display: 'flex', alignItems: 'center' }}
                onMouseEnter={e => e.currentTarget.style.color = t.accent2}
                onMouseLeave={e => e.currentTarget.style.color = t.textMuted}
              >
                {showPassword
                  ? <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                  : <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
                }
              </button>
            </div>
          </div>

          {/* Remember me + Forgot password */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', fontSize: 13, color: t.textSecondary, userSelect: 'none' }}>
              <input type="checkbox" checked={rememberMe} onChange={e => setRememberMe(e.target.checked)}
                style={{ accentColor: t.accent, width: 14, height: 14, cursor: 'pointer' }} />
              Remember me
            </label>
            <button type="button" onClick={() => setShowForgotModal(true)}
              style={{ fontSize: 13, color: t.accent2, fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
              onMouseEnter={e => e.currentTarget.style.textDecoration = 'underline'}
              onMouseLeave={e => e.currentTarget.style.textDecoration = 'none'}
            >
              Forgot password?
            </button>
          </div>

          {/* Submit */}
          <button type="submit" disabled={loading}
            style={{
              width: '100%', padding: '13px 0',
              background: 'linear-gradient(135deg, #6c63ff, #a78bfa)',
              color: '#fff', fontWeight: 700, fontSize: 15,
              border: 'none', borderRadius: 10, cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1,
              boxShadow: '0 4px 16px rgba(108,99,255,0.4)',
              transition: 'opacity 0.2s, transform 0.15s, box-shadow 0.2s',
              fontFamily: 'inherit',
            }}
            onMouseEnter={e => { if (!loading) { e.currentTarget.style.boxShadow = '0 6px 24px rgba(108,99,255,0.6)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}}
            onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 4px 16px rgba(108,99,255,0.4)'; e.currentTarget.style.transform = 'translateY(0)'; }}
          >
            {loading ? 'Signing in…' : `Log in as ${role === 'admin' ? 'Admin' : 'Student'}`}
          </button>
        </form>

        {/* Sign up footer */}
        {role === 'student' && (
          <div style={{ marginTop: 18, paddingTop: 16, borderTop: `1px solid ${t.border}`, textAlign: 'center', fontSize: 13, color: t.textSecondary, fontWeight: 500 }}>
            Don't have an account?{' '}
            <Link href="/register"
              style={{ color: t.accent2, fontWeight: 700, textDecoration: 'none' }}
              onMouseEnter={e => e.target.style.textDecoration = 'underline'}
              onMouseLeave={e => e.target.style.textDecoration = 'none'}
            >
              Sign up
            </Link>
          </div>
        )}
      </div>

      {/* ── Forgot Password Modal ── */}
      {showForgotModal && (
        <div onClick={() => setShowForgotModal(false)}
          style={{ 
            position: 'fixed', inset: 0, zIndex: 100, 
            background: 'rgba(0,0,0,0.7)', 
            display: 'flex', alignItems: 'center', justifyContent: 'center', 
            padding: '24px 16px',
            overflowY: 'auto',
            WebkitOverflowScrolling: 'touch'
          }}>
          <div onClick={e => e.stopPropagation()}
            className="forgot-modal-inner"
            style={{
              background: '#0d1526',
              border: `1px solid ${t.border}`,
              borderRadius: 18,
              padding: '32px 32px 24px',
              maxWidth: 400, width: '100%',
              boxShadow: '0 24px 64px rgba(0,0,0,0.6), 0 0 0 1px rgba(108,99,255,0.15)',
              textAlign: 'center',
              margin: 'auto'
            }}>
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(108,99,255,0.15)', border: '1px solid rgba(108,99,255,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: 26 }}>🔑</div>
            <h2 style={{ fontSize: 19, fontWeight: 800, color: t.textPrimary, marginBottom: 6 }}>Forgot Your Password?</h2>
            <p style={{ fontSize: 13, color: t.textSecondary, lineHeight: 1.7, marginBottom: 16 }}>
              Password resets are managed by the <strong style={{ color: t.textPrimary }}>Lab Coordinator</strong>. Fill in your details and send an email.
            </p>

            {/* Name input */}
            <div style={{ marginBottom: 12, textAlign: 'left' }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: t.textSecondary, marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Your Full Name</label>
              <input type="text" placeholder="Enter your full name" value={studentName} onChange={e => setStudentName(e.target.value)}
                style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', background: 'rgba(255,255,255,0.05)', border: `1px solid ${t.border}`, borderRadius: 8, color: t.textPrimary, fontSize: 14, outline: 'none', fontFamily: 'inherit' }}
                onFocus={e => e.target.style.borderColor = t.accent}
                onBlur={e => e.target.style.borderColor = t.border}
              />
            </div>

            {/* Steps */}
            <div style={{ background: 'rgba(108,99,255,0.08)', border: '1px solid rgba(108,99,255,0.2)', borderRadius: 10, padding: '12px 16px', marginBottom: 16, textAlign: 'left' }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: t.accent2, marginBottom: 6 }}>📋 Steps to reset your password:</p>
              <ol style={{ fontSize: 12, color: t.textSecondary, paddingLeft: 16, margin: 0, lineHeight: 2 }}>
                <li>Visit the Aman Computer Lab counter</li>
                <li>Provide your <strong style={{ color: t.textPrimary }}>Student ID</strong> to the coordinator</li>
                <li>Or send an email using the button below</li>
              </ol>
            </div>

            {/* Contact card */}
            <div style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${t.border}`, borderRadius: 10, padding: '12px 14px', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <span style={{ fontSize: 20 }}>👨‍💼</span>
                <div style={{ textAlign: 'left' }}>
                  <p style={{ fontSize: 11, color: t.textMuted, marginBottom: 1 }}>Contact</p>
                  <p style={{ fontSize: 13, color: t.textPrimary, fontWeight: 700 }}>Lab Coordinator — Aman Computer Lab</p>
                </div>
              </div>
              <a
                href={`mailto:aman123lab@gmail.com?subject=Password Reset Request — Student ID: ${identifier || 'YOUR_STUDENT_ID'}&body=Hello Lab Coordinator,%0A%0AI am a student at Aman Computer Lab and I have forgotten my login password.%0A%0AMy details are:%0AName: ${studentName || 'YOUR_NAME'}%0AStudent ID: ${identifier || 'YOUR_STUDENT_ID'}%0A%0AKindly help me reset my password at the earliest.%0A%0AThank you,%0A${studentName || 'Student'}`}
                style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(108,99,255,0.12)', border: '1px solid rgba(108,99,255,0.25)', borderRadius: 8, padding: '8px 12px', textDecoration: 'none', transition: 'background 0.2s' }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(108,99,255,0.22)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(108,99,255,0.12)'}
              >
                <svg width="15" height="15" viewBox="0 0 20 20" fill="#a78bfa"><path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z"/><path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z"/></svg>
                <span style={{ fontSize: 13, color: t.accent2, fontWeight: 600 }}>aman123lab@gmail.com</span>
                <span style={{ fontSize: 11, color: t.textMuted, marginLeft: 'auto' }}>Send Email →</span>
              </a>
              {(identifier || studentName) && (
                <p style={{ fontSize: 11, color: t.textMuted, marginTop: 6, textAlign: 'center' }}>
                  {studentName && <><strong style={{ color: t.accent2 }}>{studentName}</strong>{identifier ? ' · ' : ''}</>}
                  {identifier && <strong style={{ color: t.accent2 }}>{identifier}</strong>} will be pre-filled.
                </p>
              )}
            </div>

            <button onClick={() => setShowForgotModal(false)}
              style={{ width: '100%', padding: '11px 0', background: 'linear-gradient(135deg,#6c63ff,#a78bfa)', color: '#fff', fontWeight: 700, fontSize: 14, border: 'none', borderRadius: 10, cursor: 'pointer', boxShadow: '0 4px 14px rgba(108,99,255,0.35)', fontFamily: 'inherit' }}
              onMouseEnter={e => e.currentTarget.style.opacity = '0.9'}
              onMouseLeave={e => e.currentTarget.style.opacity = '1'}
            >
              Got it, thanks!
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
