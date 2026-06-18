import { useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';

export default function AdminPage() {
  const router = useRouter();

  useEffect(() => {
    // Auth guard
    let currentUser = null;
    try {
      const raw = localStorage.getItem('lab_current_user');
      currentUser = raw ? JSON.parse(raw) : null;
    } catch (_) {}

    if (!currentUser || currentUser.role !== 'admin') {
      router.replace('/login');
      return;
    }

    // Load the existing admin dashboard HTML dynamically
    // The admin HTML + JS are in the project root, served by Next.js rewrites
    window.location.replace('/index.html');
  }, [router]);

  return (
    <>
      <Head><title>Admin Dashboard — Lab Accounts</title></Head>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#0a0f1e', color: '#fff', fontFamily: 'system-ui, sans-serif' }}>
        <div>Loading Admin Dashboard...</div>
      </div>
    </>
  );
}
