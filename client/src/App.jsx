import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useSocket } from './hooks/useSocket.js';
import { api } from './api/client.js';
import { initAuth, getAuth } from './auth.js';
import { ToastProvider } from './components/Toast.jsx';
import Layout from './components/Layout.jsx';
import UserTable from './components/UserTable.jsx';
import GroupTable from './components/GroupTable.jsx';
import SudoersList from './components/SudoersList.jsx';
import SessionList from './components/SessionList.jsx';
import LoginPage from './components/LoginPage.jsx';
import AuthCallback from './components/AuthCallback.jsx';

function AuthenticatedApp() {
  const { connected, on } = useSocket();
  const [hostname, setHostname] = useState('');
  useEffect(() => { api.getHealth().then(d => setHostname(d.hostname)).catch(() => {}); }, []);

  return (
    <Layout connected={connected} hostname={hostname}>
      <Routes>
        <Route path="/" element={<Navigate to="/users" replace />} />
        <Route path="/users" element={<UserTable socketOn={on} />} />
        <Route path="/groups" element={<GroupTable socketOn={on} />} />
        <Route path="/sudo" element={<SudoersList />} />
        <Route path="/sessions" element={<SessionList />} />
      </Routes>
    </Layout>
  );
}

export default function App() {
  const [authState, setAuthState] = useState('loading'); // loading | ready | error

  useEffect(() => {
    initAuth()
      .then(() => setAuthState('ready'))
      .catch(() => setAuthState('error'));
  }, []);

  if (authState === 'loading') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg-primary, #0a0a1a)' }}>
        <p style={{ color: 'var(--text-secondary, #888)' }}>Loading...</p>
      </div>
    );
  }

  if (authState === 'error') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg-primary, #0a0a1a)' }}>
        <p style={{ color: 'var(--accent-red, #e74c3c)', marginBottom: 16 }}>Failed to load auth configuration</p>
        <button onClick={() => window.location.reload()} className="primary">Retry</button>
      </div>
    );
  }

  const auth = getAuth();
  const authenticated = auth.isAuthenticated();

  return (
    <BrowserRouter>
      <ToastProvider>
        <Routes>
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="*" element={authenticated ? <AuthenticatedApp /> : <LoginPage />} />
        </Routes>
      </ToastProvider>
    </BrowserRouter>
  );
}
