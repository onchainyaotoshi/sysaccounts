import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useSocket } from './hooks/useSocket.js';
import { api } from './api/client.js';
import { ToastProvider } from './components/Toast.jsx';
import Layout from './components/Layout.jsx';
import UserTable from './components/UserTable.jsx';
import GroupTable from './components/GroupTable.jsx';
import SudoersList from './components/SudoersList.jsx';
import SessionList from './components/SessionList.jsx';

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
            <Route path="/users" element={<UserTable socketOn={on} />} />
            <Route path="/groups" element={<GroupTable socketOn={on} />} />
            <Route path="/sudo" element={<SudoersList />} />
            <Route path="/sessions" element={<SessionList />} />
          </Routes>
        </Layout>
      </ToastProvider>
    </BrowserRouter>
  );
}
