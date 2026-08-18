import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getMe, listUsers } from '../api.js';

export default function AdminUsersPage() {
  const [checking, setChecking] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [users, setUsers] = useState([]);
  const [loadError, setLoadError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    getMe()
      .then((me) => {
        if (me.role === 'admin') {
          setAuthorized(true);
        } else {
          navigate('/login');
        }
      })
      .catch(() => navigate('/login'))
      .finally(() => setChecking(false));
  }, [navigate]);

  function reloadUsers() {
    return listUsers()
      .then(setUsers)
      .catch((err) => {
        if (err.status === 401) {
          navigate('/login');
          return;
        }
        setLoadError(err.message);
      });
  }

  useEffect(() => {
    if (!authorized) return;
    reloadUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authorized]);

  if (checking) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <img className="auth-emblem" src="/brasao-sp.png" alt="Brasão do Estado de São Paulo" />
          <p className="auth-loading">Carregando...</p>
        </div>
      </div>
    );
  }
  if (!authorized) return null;

  return (
    <div className="auth-page">
      <div className="auth-card auth-card--wide">
        <img className="auth-emblem" src="/brasao-sp.png" alt="Brasão do Estado de São Paulo" />
        <div className="auth-brand">
          <span className="auth-brand-top">SEDUC</span>
          <span className="auth-brand-bottom">AUDIT</span>
        </div>
        <div className="auth-panel">
          <div className="users-header">
            <h1 className="auth-title">Gerenciar usuários</h1>
          </div>
          {loadError && (
            <p className="auth-alert" role="alert">
              {loadError}
            </p>
          )}
          {users.length === 0 && !loadError ? (
            <p className="auth-loading">Nenhum usuário cadastrado.</p>
          ) : (
            <div className="users-table">
              <table>
                <thead>
                  <tr>
                    <th>Usuário</th>
                    <th>Papel</th>
                    <th>Criado em</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id}>
                      <td>{user.username}</td>
                      <td>{user.role}</td>
                      <td>{user.created_at}</td>
                      <td></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
