const BASE = '/api';

const ERROR_MESSAGES_PT = {
  'Invalid credentials': 'Credenciais inválidas',
  'Username already exists': 'Nome de usuário já existe',
  'Password must be at least 8 characters': 'A senha deve ter pelo menos 8 caracteres',
  'Not authenticated': 'Não autenticado',
  'Username, password and role are required': 'Usuário, senha e papel são obrigatórios',
  'Role must be "admin" or "user"': 'O papel deve ser "admin" ou "user"',
  'Username and password are required': 'Usuário e senha são obrigatórios',
  'Admin access required': 'Acesso de administrador necessário',
  'Internal server error': 'Erro interno do servidor',
  'User not found': 'Usuário não encontrado',
  'At least one field is required': 'Pelo menos um campo é obrigatório',
  'Username must be a non-empty string': 'O usuário não pode ser vazio',
  'You cannot delete your own account': 'Você não pode excluir sua própria conta',
  'Cannot delete the last remaining admin': 'Não é possível excluir o último administrador',
  'Cannot demote the last remaining admin': 'Não é possível rebaixar o último administrador',
};

function translate(message) {
  return ERROR_MESSAGES_PT[message] || message;
}

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(translate(data.error) || 'Request failed');
    err.status = res.status;
    throw err;
  }
  return data;
}

export function login(username, password) {
  return request('/login', { method: 'POST', body: JSON.stringify({ username, password }) });
}

export function logout() {
  return request('/logout', { method: 'POST' });
}

export function getMe() {
  return request('/me');
}

export function registerUser(username, password, role) {
  return request('/register', { method: 'POST', body: JSON.stringify({ username, password, role }) });
}

export function listUsers() {
  return request('/users');
}

export function updateUser(id, updates) {
  return request(`/users/${id}`, { method: 'PATCH', body: JSON.stringify(updates) });
}

export function deleteUser(id) {
  return request(`/users/${id}`, { method: 'DELETE' });
}
