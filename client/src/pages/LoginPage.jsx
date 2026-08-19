import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { login } from '../api.js';
import { UserIcon, LockIcon } from '../icons.jsx';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    try {
      const user = await login(username, password);
      if (user.role === 'admin') {
        navigate('/admin/register');
      } else {
        navigate('/home');
      }
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={handleSubmit}>
        <img className="auth-emblem" src="/brasao-sp.png" alt="Brasão do Estado de São Paulo" />
        <div className="auth-brand">
          <span className="auth-brand-top">SEDUC</span>
          <span className="auth-brand-bottom">AUDIT</span>
        </div>
        <div className="auth-panel">
          <h1 className="auth-title">Login</h1>
          {error && (
            <p className="auth-alert" role="alert">
              {error}
            </p>
          )}
          <div className="auth-fields">
            <div className="auth-field">
              <label className="sr-only" htmlFor="login-username">
                Usuário
              </label>
              <div className="auth-field-row">
                <span className="auth-field-icon" aria-hidden="true">
                  <UserIcon />
                </span>
                <input
                  id="login-username"
                  placeholder="Usuário"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="auth-field">
              <label className="sr-only" htmlFor="login-password">
                Senha
              </label>
              <div className="auth-field-row">
                <span className="auth-field-icon" aria-hidden="true">
                  <LockIcon />
                </span>
                <input
                  id="login-password"
                  type="password"
                  placeholder="Senha"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
            </div>
          </div>
          <button className="auth-button" type="submit">
            Entrar
          </button>
        </div>
      </form>
    </div>
  );
}
