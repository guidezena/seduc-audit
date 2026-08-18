import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getMe, registerUser } from '../api.js';
import { UserIcon, LockIcon, ShieldIcon } from '../icons.jsx';

export default function AdminRegisterPage() {
  const [checking, setChecking] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState('user');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
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

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (password !== confirmPassword) {
      setError('As senhas não coincidem');
      return;
    }
    try {
      const user = await registerUser(username, password, role);
      setSuccess(`Usuário "${user.username}" criado com sucesso.`);
      setUsername('');
      setPassword('');
      setConfirmPassword('');
      setRole('user');
    } catch (err) {
      if (err.status === 401) {
        navigate('/login');
        return;
      }
      setError(err.message);
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
      <form className="auth-card" onSubmit={handleSubmit}>
        <img className="auth-emblem" src="/brasao-sp.png" alt="Brasão do Estado de São Paulo" />
        <div className="auth-brand">
          <span className="auth-brand-top">SEDUC</span>
          <span className="auth-brand-bottom">AUDIT</span>
        </div>
        <div className="auth-panel">
          <h1 className="auth-title">Cadastrar usuário</h1>
          {error && (
            <p className="auth-alert" role="alert">
              {error}
            </p>
          )}
          {success && <p className="auth-success">{success}</p>}
          <div className="auth-fields">
            <div className="auth-field">
              <label className="sr-only" htmlFor="register-username">
                Usuário
              </label>
              <div className="auth-field-row">
                <span className="auth-field-icon" aria-hidden="true">
                  <UserIcon />
                </span>
                <input
                  id="register-username"
                  placeholder="Usuário"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="auth-field">
              <label className="sr-only" htmlFor="register-password">
                Senha
              </label>
              <div className="auth-field-row">
                <span className="auth-field-icon" aria-hidden="true">
                  <LockIcon />
                </span>
                <input
                  id="register-password"
                  type="password"
                  placeholder="Senha"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                />
              </div>
            </div>
            <div className="auth-field">
              <label className="sr-only" htmlFor="register-confirm-password">
                Confirmar senha
              </label>
              <div className="auth-field-row">
                <span className="auth-field-icon" aria-hidden="true">
                  <LockIcon />
                </span>
                <input
                  id="register-confirm-password"
                  type="password"
                  placeholder="Confirmar senha"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={8}
                />
              </div>
            </div>
            <div className="auth-field">
              <label className="sr-only" htmlFor="register-role">
                Papel
              </label>
              <div className="auth-field-row">
                <span className="auth-field-icon" aria-hidden="true">
                  <ShieldIcon />
                </span>
                <select id="register-role" value={role} onChange={(e) => setRole(e.target.value)}>
                  <option value="user">user</option>
                  <option value="admin">admin</option>
                </select>
              </div>
            </div>
          </div>
          <button className="auth-button" type="submit">
            Cadastrar
          </button>
        </div>
      </form>
    </div>
  );
}
