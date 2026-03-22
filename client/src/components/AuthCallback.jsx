import { useEffect, useState } from 'react';
import { getAuth } from '../auth.js';

export default function AuthCallback() {
  const [error, setError] = useState(null);

  useEffect(() => {
    const handle = async () => {
      try {
        const auth = getAuth();
        await auth.handleCallback();
        window.location.replace('/');
      } catch (err) {
        setError(err.message);
      }
    };
    handle();
  }, []);

  if (error) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg-primary, #0a0a1a)' }}>
        <h2 style={{ color: 'var(--accent-red, #e74c3c)', marginBottom: 16 }}>Authentication Error</h2>
        <p style={{ color: 'var(--text-secondary, #888)', marginBottom: 24 }}>{error}</p>
        <button onClick={() => window.location.replace('/')} className="primary">Try Again</button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg-primary, #0a0a1a)' }}>
      <p style={{ color: 'var(--text-secondary, #888)' }}>Authenticating...</p>
    </div>
  );
}
