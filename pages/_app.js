import '../styles/globals.css';
import '../styles/debtors.css';
import { useEffect, useState } from 'react';

export default function App({ Component, pageProps }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  return <Component {...pageProps} />;
}
