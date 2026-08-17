import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { login } from '../api.js';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loggedInUser, setLoggedInUser] = useState(null);
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    try {
      const user = await login(username, password);
      if (user.role === 'admin') {
        navigate('/admin/register');
      } else {
        setLoggedInUser(user);
      }
    } catch (err) {
      setError(err.message);
    }
  }

  if (loggedInUser) {
    return <p>Logado como {loggedInUser.username}.</p>;
  }

  return (
    <form onSubmit={handleSubmit}>
      <h1>Login</h1>
      {error && <p role="alert">{error}</p>}
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
        />
      </label>
      <button type="submit">Entrar</button>
    </form>
  );
}
