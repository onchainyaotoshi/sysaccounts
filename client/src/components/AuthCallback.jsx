import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAuth } from '../auth.js';

export default function AuthCallback() {
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handle = async () => {
      try {
        const auth = getAuth();
        await auth.handleCallback();
        navigate('/', { replace: true });
      } catch (err) {
        setError(err.message);
      }
    };
    handle();
  }, [navigate]);

  if (error) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg-primary, #0a0a1a)' }}>
        <h2 style={{ color: 'var(--accent-red, #e74c3c)', marginBottom: 16 }}>Authentication Error</h2>
        <p style={{ color: 'var(--text-secondary, #888)', marginBottom: 24 }}>{error}</p>
        <button onClick={() => navigate('/', { replace: true })} className="primary">Try Again</button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg-primary, #0a0a1a)' }}>
      <p style={{ color: 'var(--text-secondary, #888)' }}>Authenticating...</p>
    </div>
  );
}
