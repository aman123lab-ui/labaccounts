import { useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';

export default function DebtorsPage() {
  const router = useRouter();

  useEffect(() => {
    let currentUser = null;
    try {
      const raw = localStorage.getItem('lab_current_user');
      currentUser = raw ? JSON.parse(raw) : null;
    } catch (_) {}

    if (!currentUser || currentUser.role !== 'admin') {
      document.cookie = 'lab_role=; path=/; max-age=0; SameSite=Lax';
      router.replace('/login');
      return;
    }

    window.location.replace('/debtors.html');
  }, [router]);

  return (
    <>
      <Head><title>Student Debtors — Lab Accounts</title></Head>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#f0f2f8', color: '#1a1a2e', fontFamily: 'system-ui, sans-serif' }}>
        <div>Loading Debtors...</div>
      </div>
    </>
  );
}
