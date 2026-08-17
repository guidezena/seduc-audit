import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getMe, registerUser } from '../api.js';

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

  if (checking) return <p>Carregando...</p>;
  if (!authorized) return null;

  return (
    <form onSubmit={handleSubmit}>
      <h1>Cadastrar usuário</h1>
      {error && <p role="alert">{error}</p>}
      {success && <p>{success}</p>}
      <label>
        Usuário
        <input value={username} onChange={(e) => setUsername(e.target.value)} required />
      </label>
      <label>
        Senha
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
        />
      </label>
      <label>
        Confirmar senha
        <input
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
          minLength={8}
        />
      </label>
      <label>
        Papel
        <select value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="user">user</option>
          <option value="admin">admin</option>
        </select>
      </label>
      <button type="submit">Cadastrar</button>
    </form>
  );
}
