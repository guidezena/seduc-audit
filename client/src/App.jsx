import { Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage.jsx';
import AdminUsersPage from './pages/AdminUsersPage.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/admin/register" element={<AdminUsersPage />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
