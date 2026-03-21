import { getAuth } from '../auth.js';

export default function LoginPage() {
  const handleLogin = () => {
    const auth = getAuth();
    auth.login();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg-primary, #0a0a1a)' }}>
      <h1 style={{ color: 'var(--accent-green, #2ecc71)', fontSize: 24, marginBottom: 8 }}>SysAccounts</h1>
      <p style={{ color: 'var(--text-secondary, #888)', marginBottom: 32 }}>Sign in to continue</p>
      <button onClick={handleLogin} className="primary" style={{ padding: '10px 24px', fontSize: 14 }}>Login</button>
    </div>
  );
}
