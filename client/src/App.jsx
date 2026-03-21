import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout.jsx';

export default function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Navigate to="/users" replace />} />
          <Route path="/users" element={<div>Users</div>} />
          <Route path="/groups" element={<div>Groups</div>} />
          <Route path="/sudo" element={<div>Sudo</div>} />
          <Route path="/sessions" element={<div>Sessions</div>} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}
