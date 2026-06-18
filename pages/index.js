import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { getCurrentUser } from '../js/storage.service';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const user = getCurrentUser();
    if (user) {
      if (user.role === 'admin') {
        router.replace('/admin');
      } else {
        router.replace('/student');
      }
    } else {
      router.replace('/login');
    }
  }, [router]);

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#0a0f1e', color: '#fff', fontFamily: 'system-ui, sans-serif' }}>
      <div>Redirecting...</div>
    </div>
  );
}
