import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getMe, listUsers, registerUser, updateUser, deleteUser } from '../api.js';
import { UserIcon, LockIcon, ShieldIcon, PlusIcon, EyeIcon, PencilIcon, TrashIcon } from '../icons.jsx';
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
  const [viewingUser, setViewingUser] = useState(null);
  const [editingUser, setEditingUser] = useState(null);
  const [editUsername, setEditUsername] = useState('');
  const [editRole, setEditRole] = useState('user');
  const [editPassword, setEditPassword] = useState('');
  const [editError, setEditError] = useState('');
  const [deletingUser, setDeletingUser] = useState(null);
  const [deleteError, setDeleteError] = useState('');
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

  function openEditModal(user) {
    setEditingUser(user);
    setEditUsername(user.username);
    setEditRole(user.role);
    setEditPassword('');
    setEditError('');
  }

  async function handleEditSubmit(e) {
    e.preventDefault();
    setEditError('');
    if (editPassword && editPassword.length < 8) {
      setEditError('A senha deve ter pelo menos 8 caracteres');
      return;
    }
    const updates = { username: editUsername, role: editRole };
    if (editPassword) {
      updates.password = editPassword;
    }
    try {
      await updateUser(editingUser.id, updates);
      setEditingUser(null);
      await reloadUsers();
    } catch (err) {
      if (err.status === 401) {
        navigate('/login');
        return;
      }
      setEditError(err.message);
    }
  }

  function openDeleteConfirm(user) {
    setDeletingUser(user);
    setDeleteError('');
  }

  async function handleDeleteConfirm() {
    setDeleteError('');
    try {
      await deleteUser(deletingUser.id);
      setDeletingUser(null);
      await reloadUsers();
    } catch (err) {
      if (err.status === 401) {
        navigate('/login');
        return;
      }
      setDeleteError(err.message);
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
          <span className="auth-brand-top">SEDUC SP</span>
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
                      <td>
                        <div className="row-actions">
                          <button
                            className="icon-button"
                            type="button"
                            onClick={() => setViewingUser(user)}
                            aria-label={`Ver ${user.username}`}
                          >
                            <EyeIcon />
                          </button>
                          <button
                            className="icon-button"
                            type="button"
                            onClick={() => openEditModal(user)}
                            aria-label={`Editar ${user.username}`}
                          >
                            <PencilIcon />
                          </button>
                          <button
                            className="icon-button icon-button--danger"
                            type="button"
                            onClick={() => openDeleteConfirm(user)}
                            aria-label={`Excluir ${user.username}`}
                          >
                            <TrashIcon />
                          </button>
                        </div>
                      </td>
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

      {viewingUser && (
        <Modal
          title="Detalhes do usuário"
          onClose={() => setViewingUser(null)}
          footer={
            <button type="button" className="auth-button" onClick={() => setViewingUser(null)}>
              Fechar
            </button>
          }
        >
          <p>
            <strong>ID:</strong> {viewingUser.id}
          </p>
          <p>
            <strong>Usuário:</strong> {viewingUser.username}
          </p>
          <p>
            <strong>Papel:</strong> {viewingUser.role}
          </p>
          <p>
            <strong>Criado em:</strong> {viewingUser.created_at}
          </p>
        </Modal>
      )}

      {editingUser && (
        <Modal title="Editar usuário" onClose={() => setEditingUser(null)}>
          <form onSubmit={handleEditSubmit} className="auth-fields">
            {editError && (
              <p className="auth-alert" role="alert">
                {editError}
              </p>
            )}
            <div className="auth-field">
              <label className="sr-only" htmlFor="edit-username">
                Usuário
              </label>
              <div className="auth-field-row">
                <span className="auth-field-icon" aria-hidden="true">
                  <UserIcon />
                </span>
                <input
                  id="edit-username"
                  placeholder="Usuário"
                  value={editUsername}
                  onChange={(e) => setEditUsername(e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="auth-field">
              <label className="sr-only" htmlFor="edit-role">
                Papel
              </label>
              <div className="auth-field-row">
                <span className="auth-field-icon" aria-hidden="true">
                  <ShieldIcon />
                </span>
                <select id="edit-role" value={editRole} onChange={(e) => setEditRole(e.target.value)}>
                  <option value="user">user</option>
                  <option value="admin">admin</option>
                </select>
              </div>
            </div>
            <div className="auth-field">
              <label className="sr-only" htmlFor="edit-password">
                Nova senha
              </label>
              <div className="auth-field-row">
                <span className="auth-field-icon" aria-hidden="true">
                  <LockIcon />
                </span>
                <input
                  id="edit-password"
                  type="password"
                  placeholder="Nova senha (opcional)"
                  value={editPassword}
                  onChange={(e) => setEditPassword(e.target.value)}
                  minLength={8}
                />
              </div>
            </div>
            <p className="modal-hint">Deixe a senha em branco para mantê-la.</p>
            <div className="modal-actions">
              <button
                type="button"
                className="auth-button auth-button--secondary"
                onClick={() => setEditingUser(null)}
              >
                Cancelar
              </button>
              <button type="submit" className="auth-button">
                Salvar
              </button>
            </div>
          </form>
        </Modal>
      )}

      {deletingUser && (
        <Modal
          title="Excluir usuário"
          onClose={() => setDeletingUser(null)}
          footer={
            <>
              <button
                type="button"
                className="auth-button auth-button--secondary"
                onClick={() => setDeletingUser(null)}
              >
                Cancelar
              </button>
              <button type="button" className="auth-button auth-button--danger" onClick={handleDeleteConfirm}>
                Excluir
              </button>
            </>
          }
        >
          {deleteError && (
            <p className="auth-alert" role="alert">
              {deleteError}
            </p>
          )}
          <p>Excluir o usuário "{deletingUser.username}"? Essa ação não pode ser desfeita.</p>
        </Modal>
      )}
    </div>
  );
}
