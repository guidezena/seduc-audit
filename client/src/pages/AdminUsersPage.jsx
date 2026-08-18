import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getMe, listUsers, registerUser } from '../api.js';
import { UserIcon, LockIcon, ShieldIcon, PlusIcon } from '../icons.jsx';
import Modal from '../components/Modal.jsx';

export default function AdminUsersPage() {
  const [checking, setChecking] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [users, setUsers] = useState([]);
  const [loadError, setLoadError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [createUsername, setCreateUsername] = useState('');
  const [createPassword, setCreatePassword] = useState('');
  const [createConfirmPassword, setCreateConfirmPassword] = useState('');
  const [createRole, setCreateRole] = useState('user');
  const [createError, setCreateError] = useState('');
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

  function openCreateModal() {
    setCreateUsername('');
    setCreatePassword('');
    setCreateConfirmPassword('');
    setCreateRole('user');
    setCreateError('');
    setShowCreate(true);
  }

  async function handleCreateSubmit(e) {
    e.preventDefault();
    setCreateError('');
    if (createPassword !== createConfirmPassword) {
      setCreateError('As senhas não coincidem');
      return;
    }
    try {
      await registerUser(createUsername, createPassword, createRole);
      setShowCreate(false);
      await reloadUsers();
    } catch (err) {
      if (err.status === 401) {
        navigate('/login');
        return;
      }
      setCreateError(err.message);
    }
  }

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
            <button className="icon-button" type="button" onClick={openCreateModal} aria-label="Novo usuário">
              <PlusIcon />
            </button>
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

      {showCreate && (
        <Modal title="Novo usuário" onClose={() => setShowCreate(false)}>
          <form onSubmit={handleCreateSubmit} className="auth-fields">
            {createError && (
              <p className="auth-alert" role="alert">
                {createError}
              </p>
            )}
            <div className="auth-field">
              <label className="sr-only" htmlFor="create-username">
                Usuário
              </label>
              <div className="auth-field-row">
                <span className="auth-field-icon" aria-hidden="true">
                  <UserIcon />
                </span>
                <input
                  id="create-username"
                  placeholder="Usuário"
                  value={createUsername}
                  onChange={(e) => setCreateUsername(e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="auth-field">
              <label className="sr-only" htmlFor="create-password">
                Senha
              </label>
              <div className="auth-field-row">
                <span className="auth-field-icon" aria-hidden="true">
                  <LockIcon />
                </span>
                <input
                  id="create-password"
                  type="password"
                  placeholder="Senha"
                  value={createPassword}
                  onChange={(e) => setCreatePassword(e.target.value)}
                  required
                  minLength={8}
                />
              </div>
            </div>
            <div className="auth-field">
              <label className="sr-only" htmlFor="create-confirm-password">
                Confirmar senha
              </label>
              <div className="auth-field-row">
                <span className="auth-field-icon" aria-hidden="true">
                  <LockIcon />
                </span>
                <input
                  id="create-confirm-password"
                  type="password"
                  placeholder="Confirmar senha"
                  value={createConfirmPassword}
                  onChange={(e) => setCreateConfirmPassword(e.target.value)}
                  required
                  minLength={8}
                />
              </div>
            </div>
            <div className="auth-field">
              <label className="sr-only" htmlFor="create-role">
                Papel
              </label>
              <div className="auth-field-row">
                <span className="auth-field-icon" aria-hidden="true">
                  <ShieldIcon />
                </span>
                <select id="create-role" value={createRole} onChange={(e) => setCreateRole(e.target.value)}>
                  <option value="user">user</option>
                  <option value="admin">admin</option>
                </select>
              </div>
            </div>
            <div className="modal-actions">
              <button
                type="button"
                className="auth-button auth-button--secondary"
                onClick={() => setShowCreate(false)}
              >
                Cancelar
              </button>
              <button type="submit" className="auth-button">
                Cadastrar
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
