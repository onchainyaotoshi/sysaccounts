import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useSocket } from './hooks/useSocket.js';
import { api } from './api/client.js';
import { ToastProvider } from './components/Toast.jsx';
import Layout from './components/Layout.jsx';

function Placeholder({ name }) {
  return <div style={{ color: 'var(--text-secondary)', padding: 40 }}>{name} page - coming soon</div>;
}

export default function App() {
  const { connected, on } = useSocket();
  const [hostname, setHostname] = useState('');
  useEffect(() => { api.getHealth().then(d => setHostname(d.hostname)).catch(() => {}); }, []);

  return (
    <BrowserRouter>
      <ToastProvider>
        <Layout connected={connected} hostname={hostname}>
          <Routes>
            <Route path="/" element={<Navigate to="/users" replace />} />
            <Route path="/users" element={<Placeholder name="Users" />} />
            <Route path="/groups" element={<Placeholder name="Groups" />} />
            <Route path="/sudo" element={<Placeholder name="Sudo" />} />
            <Route path="/sessions" element={<Placeholder name="Sessions" />} />
          </Routes>
        </Layout>
      </ToastProvider>
    </BrowserRouter>
  );
}
