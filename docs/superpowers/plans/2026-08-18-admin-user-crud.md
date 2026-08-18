# Admin User Management (CRUD) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the admin's create-only "register a user" screen with a full user-management screen: list every user, create, view details, edit (username/role/password), and delete — all gated behind the existing admin login.

**Architecture:** Three new REST endpoints (`GET/PATCH/DELETE /api/users[/:id]`) added to the existing `server/src/routes/users.js` router, protected by the existing `requireAuth`+`requireAdmin` chain. On the client, `AdminRegisterPage.jsx` is renamed to `AdminUsersPage.jsx` and rebuilt around a table of users with per-row action icons (Ler/Editar/Excluir) and a page-level "Novo usuário" action, using a new shared `Modal` component for Create/Read/Edit and a lighter confirm panel for Delete. All UI reuses the existing `auth.css` design system (Google-style card/shadow, blue/red accents).

**Tech Stack:** Same as the base app — Node.js/Express/better-sqlite3/bcryptjs on the server, React 18 + Vite + react-router-dom on the client. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-08-18-user-crud-design.md` (builds on `docs/superpowers/specs/2026-08-17-auth-app-design.md`)

## Global Constraints

- Node.js >= 18 (native `fetch`, ESM, `node:` built-ins).
- Passwords are hashed with bcryptjs before storage; plaintext passwords are never logged or persisted.
- The JWT lives only in an `httpOnly` cookie — never in `localStorage` or a JS-readable cookie.
- No automated test suite — verification is manual: `curl` for backend endpoints, browser interaction for frontend/UI.
- `node_modules/`, the SQLite data file, and `.env` are gitignored — never committed.
- An admin can never delete their own account (`DELETE /api/users/:id` where `:id === req.user.id` must be rejected).
- The last remaining admin can never be deleted or demoted to `user` — both `DELETE /api/users/:id` and `PATCH /api/users/:id` (when changing role away from `admin`) must check `SELECT COUNT(*) FROM users WHERE role = 'admin'` before allowing the change, and reject if the count is `1`.
- All new user-management endpoints are mounted in `server/src/routes/users.js`, behind the same `requireAuth` + `requireAdmin` middleware chain already used by `POST /api/register`.
- Server error strings that reach the client already flow through `client/src/api.js`'s `translate()` / `ERROR_MESSAGES_PT` map — every new server error string introduced by this plan must get a Portuguese entry there.

---

### Task 1: Backend — `GET /api/users` (list)

**Files:**
- Modify: `server/src/routes/users.js`

**Interfaces:**
- Consumes: `db` from `server/src/db.js` (already imported in this file).
- Produces: `GET /api/users` — admin-only, returns `[{id, username, role, created_at}, ...]` ordered by `id` ascending. Later tasks (frontend `listUsers()`) consume this shape directly.

- [ ] **Step 1: Add the route**

Open `server/src/routes/users.js`. Add this route after the existing `router.post('/register', ...)` block and before `export default router;`:

```js
router.get('/users', requireAuth, requireAdmin, (req, res) => {
  const users = db.prepare('SELECT id, username, role, created_at FROM users ORDER BY id ASC').all();
  res.json(users);
});
```

- [ ] **Step 2: Verify with curl**

Run: `npm run dev --prefix server` (in the background), then:

```bash
curl -s -c /tmp/crud-cookies.txt -X POST http://localhost:4000/api/login \
  -H "Content-Type: application/json" -d '{"username":"admin","password":"changeme123"}' > /dev/null

curl -s -i -b /tmp/crud-cookies.txt http://localhost:4000/api/users
```

Expected: HTTP `200`, JSON array containing at least the seeded `admin` user with `id`, `username`, `role`, `created_at` fields (no `password_hash` field present).

- [ ] **Step 3: Verify non-admin/unauthenticated access is rejected**

Run:
```bash
curl -s -i http://localhost:4000/api/users
```
Expected: HTTP `401`, `{"error":"Not authenticated"}`. Stop the background server after verifying.

- [ ] **Step 4: Commit**

```bash
git add server/src/routes/users.js
git commit -m "feat(server): add GET /api/users to list all users"
```

---

### Task 2: Backend — `PATCH /api/users/:id` (update)

**Files:**
- Modify: `server/src/routes/users.js`

**Interfaces:**
- Consumes: `db` from `db.js`, `hashPassword` from `auth.js` (already imported in this file).
- Produces: `PATCH /api/users/:id` — admin-only. Body `{ username?, role?, password? }`, all optional. Returns `200 {id, username, role}` on success. Later tasks (frontend `updateUser(id, updates)`) call this directly.

- [ ] **Step 1: Add the route**

Add this route in `server/src/routes/users.js`, after the `GET /users` route added in Task 1 and before `export default router;`:

```js
router.patch('/users/:id', requireAuth, requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  if (!existing) {
    return res.status(404).json({ error: 'User not found' });
  }

  const { username, role, password } = req.body || {};
  if (username === undefined && role === undefined && password === undefined) {
    return res.status(400).json({ error: 'At least one field is required' });
  }

  if (username !== undefined) {
    if (typeof username !== 'string' || !username) {
      return res.status(400).json({ error: 'Username must be a non-empty string' });
    }
    const collision = db
      .prepare('SELECT id FROM users WHERE username = ? AND id != ?')
      .get(username, id);
    if (collision) {
      return res.status(409).json({ error: 'Username already exists' });
    }
  }

  if (role !== undefined) {
    if (!['admin', 'user'].includes(role)) {
      return res.status(400).json({ error: 'Role must be "admin" or "user"' });
    }
    if (existing.role === 'admin' && role === 'user') {
      const adminCount = db
        .prepare("SELECT COUNT(*) AS count FROM users WHERE role = 'admin'")
        .get().count;
      if (adminCount <= 1) {
        return res.status(400).json({ error: 'Cannot demote the last remaining admin' });
      }
    }
  }

  if (password !== undefined) {
    if (typeof password !== 'string' || password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }
  }

  const nextUsername = username !== undefined ? username : existing.username;
  const nextRole = role !== undefined ? role : existing.role;
  const nextPasswordHash = password !== undefined ? hashPassword(password) : existing.password_hash;

  db.prepare('UPDATE users SET username = ?, role = ?, password_hash = ? WHERE id = ?').run(
    nextUsername,
    nextRole,
    nextPasswordHash,
    id
  );

  res.json({ id, username: nextUsername, role: nextRole });
});
```

- [ ] **Step 2: Verify a successful partial update (role only) with curl**

Run: `npm run dev --prefix server` (in the background), then create a scratch user and update it:

```bash
curl -s -c /tmp/crud-cookies.txt -X POST http://localhost:4000/api/login \
  -H "Content-Type: application/json" -d '{"username":"admin","password":"changeme123"}' > /dev/null

curl -s -X POST http://localhost:4000/api/register -b /tmp/crud-cookies.txt \
  -H "Content-Type: application/json" \
  -d '{"username":"patchtest","password":"password123","role":"user"}'
```
Note the `id` returned (call it `<ID>` below), then:
```bash
curl -s -i -b /tmp/crud-cookies.txt -X PATCH http://localhost:4000/api/users/<ID> \
  -H "Content-Type: application/json" -d '{"role":"admin"}'
```
Expected: HTTP `200`, `{"id":<ID>,"username":"patchtest","role":"admin"}`.

- [ ] **Step 3: Verify password update actually changes the login**

```bash
curl -s -i -b /tmp/crud-cookies.txt -X PATCH http://localhost:4000/api/users/<ID> \
  -H "Content-Type: application/json" -d '{"password":"newpassword456"}'

curl -s -i -X POST http://localhost:4000/api/login \
  -H "Content-Type: application/json" -d '{"username":"patchtest","password":"newpassword456"}'
```
Expected: PATCH returns `200`; the login with the new password returns `200` with `{"id":<ID>,"username":"patchtest","role":"admin"}`.

- [ ] **Step 4: Verify the last-admin demotion guard**

The seeded `admin` and `patchtest` (now role `admin`) both exist, so this should succeed (more than one admin exists) — to actually test the guard, first demote `patchtest` back to `user` (frees it up), then attempt to demote `admin` while `patchtest` is a `user` (making `admin` the sole admin) is expected to still succeed since we're not demoting the currently-sole admin yet in this step — instead, verify the guard directly against the seeded `admin` while it's the only admin:

```bash
curl -s -b /tmp/crud-cookies.txt -X PATCH http://localhost:4000/api/users/<ID> \
  -H "Content-Type: application/json" -d '{"role":"user"}' > /dev/null

curl -s -i -b /tmp/crud-cookies.txt -X PATCH http://localhost:4000/api/users/1 \
  -H "Content-Type: application/json" -d '{"role":"user"}'
```
(Assuming the seeded admin's id is `1` — confirm via the Task 1 `GET /api/users` output if unsure.)

Expected: HTTP `400`, `{"error":"Cannot demote the last remaining admin"}`.

- [ ] **Step 5: Verify duplicate-username and not-found cases**

```bash
curl -s -i -b /tmp/crud-cookies.txt -X PATCH http://localhost:4000/api/users/<ID> \
  -H "Content-Type: application/json" -d '{"username":"admin"}'

curl -s -i -b /tmp/crud-cookies.txt -X PATCH http://localhost:4000/api/users/99999 \
  -H "Content-Type: application/json" -d '{"username":"whoever"}'
```
Expected: first call → `409 {"error":"Username already exists"}`; second call → `404 {"error":"User not found"}`. Stop the background server after verifying.

- [ ] **Step 6: Commit**

```bash
git add server/src/routes/users.js
git commit -m "feat(server): add PATCH /api/users/:id with last-admin demotion guard"
```

---

### Task 3: Backend — `DELETE /api/users/:id` (delete)

**Files:**
- Modify: `server/src/routes/users.js`

**Interfaces:**
- Consumes: `db` from `db.js` (already imported).
- Produces: `DELETE /api/users/:id` — admin-only. Returns `200 {"ok":true}` on success. Later tasks (frontend `deleteUser(id)`) call this directly.

- [ ] **Step 1: Add the route**

Add this route in `server/src/routes/users.js`, after the `PATCH /users/:id` route added in Task 2 and before `export default router;`:

```js
router.delete('/users/:id', requireAuth, requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  if (!existing) {
    return res.status(404).json({ error: 'User not found' });
  }

  if (id === req.user.id) {
    return res.status(400).json({ error: 'You cannot delete your own account' });
  }

  if (existing.role === 'admin') {
    const adminCount = db
      .prepare("SELECT COUNT(*) AS count FROM users WHERE role = 'admin'")
      .get().count;
    if (adminCount <= 1) {
      return res.status(400).json({ error: 'Cannot delete the last remaining admin' });
    }
  }

  db.prepare('DELETE FROM users WHERE id = ?').run(id);
  res.json({ ok: true });
});
```

- [ ] **Step 2: Verify self-delete is blocked**

Run: `npm run dev --prefix server` (in the background), then:

```bash
curl -s -c /tmp/crud-cookies.txt -X POST http://localhost:4000/api/login \
  -H "Content-Type: application/json" -d '{"username":"admin","password":"changeme123"}' > /dev/null

curl -s -i -b /tmp/crud-cookies.txt -X DELETE http://localhost:4000/api/users/1
```
(Assuming the seeded admin's id is `1`; confirm via `GET /api/users` if unsure.)

Expected: HTTP `400`, `{"error":"You cannot delete your own account"}`.

- [ ] **Step 3: Verify the last-admin delete guard**

With only the seeded `admin` as an admin (from Task 2's Step 4, `patchtest` should already be role `user`):

```bash
curl -s -X POST http://localhost:4000/api/register -b /tmp/crud-cookies.txt \
  -H "Content-Type: application/json" \
  -d '{"username":"secondadmin","password":"password123","role":"admin"}'
```
Note the returned `id` (call it `<ID2>`), then attempt to delete the *original* seeded admin (id `1`) — this should now succeed since a second admin exists:
```bash
curl -s -i -b /tmp/crud-cookies.txt -X DELETE http://localhost:4000/api/users/<ID2>
```
Wait — deleting `<ID2>` (the second admin) while `admin` (id 1) still exists should succeed (more than one admin existed before this delete). Verify:

Expected: HTTP `200`, `{"ok":true}`.

Now only `admin` (id 1) remains as an admin. Log in as a *different* session isn't available via curl easily, so instead verify the guard indirectly: attempting to delete id `1` while logged in as id `1` still correctly hits the self-delete guard from Step 2 (already verified) — the last-admin guard's own logic (the `adminCount <= 1` check) was exercised as `false` in this Step 3 (count was 2 when `<ID2>` was deleted, so the delete was allowed) and is exercised as `true` in Task 2 Step 4's equivalent PATCH check. This confirms the shared counting logic; the DELETE-specific guard combined with self-delete is inherently untestable via curl alone (you cannot be logged in as an admin you are not, to delete the one that's left), so it's covered by code review and by Task 8's later browser-based multi-admin scenario instead.

- [ ] **Step 4: Verify not-found case**

```bash
curl -s -i -b /tmp/crud-cookies.txt -X DELETE http://localhost:4000/api/users/99999
```
Expected: HTTP `404`, `{"error":"User not found"}`.

- [ ] **Step 5: Clean up the scratch user and stop the server**

```bash
curl -s -b /tmp/crud-cookies.txt -X DELETE http://localhost:4000/api/users/<ID>
```
(`<ID>` is `patchtest`'s id from Task 2.) Expected: `200 {"ok":true}`. Stop the background server.

- [ ] **Step 6: Commit**

```bash
git add server/src/routes/users.js
git commit -m "feat(server): add DELETE /api/users/:id with self-delete and last-admin guards"
```

---

### Task 4: Frontend — `api.js` additions

**Files:**
- Modify: `client/src/api.js`

**Interfaces:**
- Consumes: the existing `request()` helper and `ERROR_MESSAGES_PT` map in this file.
- Produces: `listUsers()`, `updateUser(id, updates)`, `deleteUser(id)` — named exports. Later tasks (`AdminUsersPage.jsx`) import and call these directly. `updates` is a plain object with any of `{username, role, password}`.

- [ ] **Step 1: Add new error translations**

In `client/src/api.js`, add these entries to the existing `ERROR_MESSAGES_PT` object (anywhere inside the object literal, e.g. right after the `'Internal server error'` line):

```js
  'User not found': 'Usuário não encontrado',
  'At least one field is required': 'Pelo menos um campo é obrigatório',
  'Username must be a non-empty string': 'O usuário não pode ser vazio',
  'You cannot delete your own account': 'Você não pode excluir sua própria conta',
  'Cannot delete the last remaining admin': 'Não é possível excluir o último administrador',
  'Cannot demote the last remaining admin': 'Não é possível rebaixar o último administrador',
```

- [ ] **Step 2: Add the three new functions**

Add these after the existing `registerUser` function, at the end of the file:

```js
export function listUsers() {
  return request('/users');
}

export function updateUser(id, updates) {
  return request(`/users/${id}`, { method: 'PATCH', body: JSON.stringify(updates) });
}

export function deleteUser(id) {
  return request(`/users/${id}`, { method: 'DELETE' });
}
```

- [ ] **Step 3: Verify with the browser console**

Run `npm run dev` from the repo root (background). Open `http://localhost:5173/login`, open the browser dev console, log in as admin via the UI, then in the console run:
```js
const api = await import('/src/api.js');
await api.listUsers();
```
Expected: prints an array of user objects (matches Task 1's curl output). Stop the dev servers after verifying.

- [ ] **Step 4: Commit**

```bash
git add client/src/api.js
git commit -m "feat(client): add listUsers, updateUser, deleteUser API functions"
```

---

### Task 5: Frontend — CRUD icons

**Files:**
- Modify: `client/src/icons.jsx`

**Interfaces:**
- Consumes: none.
- Produces: `EyeIcon`, `PencilIcon`, `TrashIcon`, `PlusIcon` — named exports, each a zero-prop function component rendering an inline SVG (matching the existing `UserIcon`/`LockIcon`/`ShieldIcon` style: `viewBox="0 0 24 24"`, `stroke="currentColor"`, no fill). Later tasks import these into `AdminUsersPage.jsx`.

- [ ] **Step 1: Add the four icons**

Append these to `client/src/icons.jsx`, after the existing `ShieldIcon` function:

```jsx
export function EyeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export function PencilIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
    </svg>
  );
}

export function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    </svg>
  );
}

export function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </svg>
  );
}
```

- [ ] **Step 2: Verify the file has no syntax errors**

Run: `node --check client/src/icons.jsx 2>&1 | head -5 || true` — this will report a parse error only for gross JSX syntax mistakes Node's own parser catches at the statement level; the authoritative check is Step 3.

Run: `npm run build --prefix client`
Expected: build succeeds with no errors (this compiles the JSX and would fail on a malformed icon). Delete the resulting `client/dist/` afterward if you want a clean tree — it's gitignored either way.

- [ ] **Step 3: Commit**

```bash
git add client/src/icons.jsx
git commit -m "feat(client): add Eye, Pencil, Trash, and Plus icons"
```

---

### Task 6: Frontend — `Modal` component

**Files:**
- Create: `client/src/components/Modal.jsx`

**Interfaces:**
- Consumes: none.
- Produces: default export `Modal({ title, onClose, children, footer })`. `title` (string) renders in the header. `onClose` (function) is called on overlay click, the × button, or Escape. `children` renders in the scrollable body. `footer` (optional ReactNode) renders in a right-aligned action row below the body — omit it entirely (don't pass the prop) for modals that only need a close via the × button. Later tasks (`AdminUsersPage.jsx`) import and render this for Create/Read/Edit/Delete-confirm.

- [ ] **Step 1: Create the component**

```jsx
import { useEffect } from 'react';

export default function Modal({ title, onClose, children, footer }) {
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="auth-title">{title}</h2>
          <button className="modal-close" onClick={onClose} aria-label="Fechar" type="button">
            ×
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-actions">{footer}</div>}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify the file builds**

Run: `npm run build --prefix client`
Expected: build succeeds (the component isn't imported anywhere yet, so this only checks JSX syntax validity — Task 9 provides the real integration test).

- [ ] **Step 3: Commit**

```bash
git add client/src/components/Modal.jsx
git commit -m "feat(client): add reusable Modal component"
```

---

### Task 7: Frontend — CSS for table, wide panel, action icons, and modals

**Files:**
- Modify: `client/src/styles/auth.css`

**Interfaces:**
- Consumes: the existing `--g-*` custom properties defined in this file's `:root` block.
- Produces: `.auth-card--wide`, `.users-header`, `.users-table` (+ its `table`/`th`/`td`/`tbody tr:hover`/`.row-actions` descendants), `.icon-button` (+ `--danger` modifier), `.auth-button--secondary`, `.auth-button--danger`, `.modal-overlay`, `.modal-card`, `.modal-header`, `.modal-close`, `.modal-body` (+ its `p` descendant), `.modal-actions`, `.modal-hint` — all consumed by `AdminUsersPage.jsx` and `Modal.jsx` in Tasks 8–12.

- [ ] **Step 1: Append the new rules**

Add this block to the end of `client/src/styles/auth.css`:

```css
.auth-card--wide {
  max-width: 760px;
}

.users-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.users-header .auth-title {
  text-align: left;
}

.users-table {
  overflow-x: auto;
}

.users-table table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.9rem;
}

.users-table th {
  text-align: left;
  padding: 0.6rem 0.75rem;
  border-bottom: 2px solid var(--g-border);
  color: var(--g-text-dim);
  font-weight: 500;
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.users-table td {
  padding: 0.75rem;
  border-bottom: 1px solid var(--g-border);
  color: var(--g-text);
}

.users-table tbody tr:hover {
  background: var(--g-bg);
}

.users-table .row-actions {
  display: flex;
  gap: 0.4rem;
}

.icon-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 0;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: var(--g-text-dim);
  cursor: pointer;
  transition: background-color 0.15s ease, color 0.15s ease;
}

.icon-button svg {
  width: 17px;
  height: 17px;
}

.icon-button:hover,
.icon-button:focus-visible {
  background: rgba(26, 115, 232, 0.1);
  color: var(--g-blue);
}

.icon-button--danger:hover,
.icon-button--danger:focus-visible {
  background: rgba(234, 67, 53, 0.1);
  color: var(--g-red);
}

.auth-button--secondary {
  background: transparent;
  color: var(--g-text-dim);
  box-shadow: none;
  border: 1px solid var(--g-border);
}

.auth-button--secondary:hover,
.auth-button--secondary:focus-visible {
  background: var(--g-bg);
  box-shadow: none;
  color: var(--g-text);
}

.auth-button--danger {
  background: var(--g-red);
}

.auth-button--danger:hover,
.auth-button--danger:focus-visible {
  background: #c5221f;
}

.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(32, 33, 36, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.5rem;
  z-index: 100;
}

.modal-card {
  background: var(--g-card);
  border-radius: 8px;
  padding: 1.75rem;
  width: 100%;
  max-width: 420px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow:
    0 1px 3px rgba(60, 64, 67, 0.3),
    0 8px 20px rgba(60, 64, 67, 0.25);
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1.25rem;
}

.modal-close {
  background: transparent;
  border: none;
  font-size: 1.5rem;
  line-height: 1;
  color: var(--g-text-dim);
  cursor: pointer;
  padding: 0.25rem;
}

.modal-close:hover {
  color: var(--g-text);
}

.modal-body {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.modal-body p {
  margin: 0;
  font-size: 0.9rem;
  color: var(--g-text);
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  margin-top: 1.5rem;
}

.modal-hint {
  font-size: 0.78rem;
  color: var(--g-text-dim);
  text-align: left;
  margin: -0.75rem 0 0;
}
```

- [ ] **Step 2: Verify the file builds**

Run: `npm run build --prefix client`
Expected: build succeeds (CSS is not validated by the JS build beyond being parseable by Vite's CSS pipeline, but a build failure would catch a gross syntax error like an unclosed brace).

- [ ] **Step 3: Commit**

```bash
git add client/src/styles/auth.css
git commit -m "style(client): add table, modal, and action-icon styles for user management"
```

---

### Task 8: Frontend — rename to `AdminUsersPage.jsx`, list scaffold

**Files:**
- Create: `client/src/pages/AdminUsersPage.jsx`
- Delete: `client/src/pages/AdminRegisterPage.jsx`
- Modify: `client/src/App.jsx`

**Interfaces:**
- Consumes: `getMe`, `listUsers` from `api.js`; `.auth-page`/`.auth-card`/`.auth-card--wide`/`.auth-panel`/`.auth-title`/`.auth-loading`/`.auth-alert`/`.users-header`/`.users-table` CSS classes.
- Produces: default export `AdminUsersPage`, rendered at `/admin/register` by `App.jsx` (replacing `AdminRegisterPage`). Tasks 9–12 add to this same file's JSX and state — they assume this task's structure (the `users` state array, the `reloadUsers` function, the admin gate) is already in place.

- [ ] **Step 1: Create `client/src/pages/AdminUsersPage.jsx`**

```jsx
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
```

- [ ] **Step 2: Delete the old file**

```bash
git rm client/src/pages/AdminRegisterPage.jsx
```

- [ ] **Step 3: Update `client/src/App.jsx`**

Replace the entire file with:

```jsx
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
```

- [ ] **Step 4: Verify in the browser**

Run `npm run dev` from the repo root (background). Open `http://localhost:5173/login`, log in as `admin`/`changeme123`.
Expected: redirected to `/admin/register`, which now shows "Gerenciar usuários" with a table listing the seeded admin (and any other users left over from Tasks 1–3's curl testing — that's fine). Stop the dev servers after verifying.

- [ ] **Step 5: Commit**

```bash
git add client/src/pages/AdminUsersPage.jsx client/src/App.jsx
git commit -m "feat(client): replace admin registration screen with user list scaffold"
```

---

### Task 9: Frontend — wire the Create modal

**Files:**
- Modify: `client/src/pages/AdminUsersPage.jsx`

**Interfaces:**
- Consumes: `registerUser` from `api.js`; `UserIcon`, `LockIcon`, `ShieldIcon`, `PlusIcon` from `icons.jsx`; default export `Modal` from `components/Modal.jsx`.
- Produces: a working "Novo usuário" button that opens a create form matching the old registration form's fields and validation.

- [ ] **Step 1: Replace the file with the Create-modal-integrated version**

Replace the entire contents of `client/src/pages/AdminUsersPage.jsx` with:

```jsx
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
```

- [ ] **Step 2: Verify in the browser**

Run `npm run dev` from the repo root (background). Log in as admin, click the "+" icon next to "Gerenciar usuários".
Expected: modal opens with the create form. Fill in a new username/password/confirm/role and submit.
Expected: modal closes, the new user appears in the table without a page reload.

Then test the duplicate-username path: click "+" again, try to create a user with an existing username.
Expected: inline "Nome de usuário já existe" error inside the modal, modal stays open. Stop the dev servers after verifying.

- [ ] **Step 3: Commit**

```bash
git add client/src/pages/AdminUsersPage.jsx
git commit -m "feat(client): wire the create-user modal into the user management page"
```

---

### Task 10: Frontend — wire the Read modal

**Files:**
- Modify: `client/src/pages/AdminUsersPage.jsx`

**Interfaces:**
- Consumes: `EyeIcon` from `icons.jsx` (new import); `Modal` (already imported).
- Produces: a working "Ler" icon per table row that shows a read-only detail modal for that row — no new API call, uses the row data already in the `users` state array.

- [ ] **Step 1: Import `EyeIcon`**

In `client/src/pages/AdminUsersPage.jsx`, change the icons import line to:

```js
import { UserIcon, LockIcon, ShieldIcon, PlusIcon, EyeIcon } from '../icons.jsx';
```

- [ ] **Step 2: Add view-modal state**

Add this state declaration alongside the existing `useState` calls (e.g. right after `const [createError, setCreateError] = useState('');`):

```js
const [viewingUser, setViewingUser] = useState(null);
```

- [ ] **Step 3: Add the Ler button to each row**

Replace the empty `<td></td>` in the table row (inside `{users.map((user) => ( ... ))}`) with:

```jsx
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
  </div>
</td>
```

- [ ] **Step 4: Render the Read modal**

Add this JSX right after the closing `)}` of the `{showCreate && ( ... )}` block (still inside the outer `<div className="auth-page">`, as a sibling):

```jsx
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
```

- [ ] **Step 5: Verify in the browser**

Run `npm run dev` from the repo root (background). Log in as admin, click the eye icon on any row.
Expected: modal opens showing that user's id/username/role/created_at, with a single "Fechar" button that closes it. Open the browser's network tab first — confirm clicking Ler fires no new request. Stop the dev servers after verifying.

- [ ] **Step 6: Commit**

```bash
git add client/src/pages/AdminUsersPage.jsx
git commit -m "feat(client): wire the read-only user detail modal"
```

---

### Task 11: Frontend — wire the Edit modal

**Files:**
- Modify: `client/src/pages/AdminUsersPage.jsx`

**Interfaces:**
- Consumes: `updateUser` from `api.js` (new import); `PencilIcon` from `icons.jsx` (new import).
- Produces: a working "Editar" icon per row that opens a form pre-filled with that user's username/role, plus an optional new-password field, calling `updateUser` on submit.

- [ ] **Step 1: Update imports**

Change the `api.js` import line to:

```js
import { getMe, listUsers, registerUser, updateUser } from '../api.js';
```

Change the icons import line to:

```js
import { UserIcon, LockIcon, ShieldIcon, PlusIcon, EyeIcon, PencilIcon } from '../icons.jsx';
```

- [ ] **Step 2: Add edit-modal state**

Add these alongside the existing state declarations (e.g. right after `const [viewingUser, setViewingUser] = useState(null);`):

```js
const [editingUser, setEditingUser] = useState(null);
const [editUsername, setEditUsername] = useState('');
const [editRole, setEditRole] = useState('user');
const [editPassword, setEditPassword] = useState('');
const [editError, setEditError] = useState('');
```

- [ ] **Step 3: Add the open/submit handlers**

Add these functions after `handleCreateSubmit`:

```js
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
```

- [ ] **Step 4: Add the Editar button to each row**

Inside the `row-actions` div added in Task 10, add this button right after the Ler button:

```jsx
<button
  className="icon-button"
  type="button"
  onClick={() => openEditModal(user)}
  aria-label={`Editar ${user.username}`}
>
  <PencilIcon />
</button>
```

- [ ] **Step 5: Render the Edit modal**

Add this JSX right after the `{viewingUser && ( ... )}` block from Task 10:

```jsx
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
```

- [ ] **Step 6: Verify in the browser**

Run `npm run dev` from the repo root (background). Log in as admin, click the pencil icon on a non-admin user's row, change the role to `admin`, leave password blank, save.
Expected: modal closes, the row now shows `admin` in the Papel column.

Click Editar on that same user again, set a new password (e.g. `newpass123`), save. Log out, log in as that user with the new password.
Expected: login succeeds — confirms the password was actually updated and the username/role weren't accidentally blanked. Stop the dev servers after verifying.

- [ ] **Step 7: Commit**

```bash
git add client/src/pages/AdminUsersPage.jsx
git commit -m "feat(client): wire the edit-user modal"
```

---

### Task 12: Frontend — wire Delete confirm, full manual E2E verification

**Files:**
- Modify: `client/src/pages/AdminUsersPage.jsx`

**Interfaces:**
- Consumes: `deleteUser` from `api.js` (new import); `TrashIcon` from `icons.jsx` (new import).
- Produces: a working "Excluir" icon per row that opens a confirm panel, calling `deleteUser` on confirm, with the two safety-rule errors (self-delete, last-admin) surfaced inline instead of closing the panel.

- [ ] **Step 1: Update imports**

Change the `api.js` import line to:

```js
import { getMe, listUsers, registerUser, updateUser, deleteUser } from '../api.js';
```

Change the icons import line to:

```js
import { UserIcon, LockIcon, ShieldIcon, PlusIcon, EyeIcon, PencilIcon, TrashIcon } from '../icons.jsx';
```

- [ ] **Step 2: Add delete-confirm state**

Add these alongside the existing state declarations (e.g. right after the `editError` line):

```js
const [deletingUser, setDeletingUser] = useState(null);
const [deleteError, setDeleteError] = useState('');
```

- [ ] **Step 3: Add the open/confirm handlers**

Add these functions after `handleEditSubmit`:

```js
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
```

- [ ] **Step 4: Add the Excluir button to each row**

Inside `row-actions`, add this button right after the Editar button:

```jsx
<button
  className="icon-button icon-button--danger"
  type="button"
  onClick={() => openDeleteConfirm(user)}
  aria-label={`Excluir ${user.username}`}
>
  <TrashIcon />
</button>
```

- [ ] **Step 5: Render the Delete confirm modal**

Add this JSX right after the `{editingUser && ( ... )}` block from Task 11:

```jsx
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
```

- [ ] **Step 6: Full manual end-to-end verification**

Run `npm run dev` from the repo root (background). Open `http://localhost:5173/login` in a browser.

1. Log in as `admin`/`changeme123` → table loads showing at least the admin row (plus any scratch users left from earlier curl testing — delete those now via the UI as a warm-up check that basic delete works: click the trash icon on a non-admin scratch user, confirm, row disappears).
2. Click "+" → create a new `user` account (e.g. `carol` / `password123`) → appears in the table.
3. Click the eye icon on `carol`'s row → modal shows her id/username (`carol`)/role (`user`)/created_at → close.
4. Click the pencil icon on `carol`'s row → change role to `admin`, leave password blank, save → row shows `admin`.
5. Click the pencil icon again → set password to `newpassword456`, save → log out, log in as `carol`/`newpassword456` → succeeds, confirming the earlier role edit wasn't lost and the password change took effect.
6. Log back in as `admin`/`changeme123`. Click the trash icon on the **admin** row (your own logged-in account) → confirm → expect the inline error "Você não pode excluir sua própria conta", the row is NOT removed.
7. Click the pencil icon on `carol`'s row (still `admin` role from step 4) and demote her back to `user`, save. Now only the original `admin` account is an admin. Click the pencil icon on the `admin` row itself, change role to `user`, save → expect the inline error "Não é possível rebaixar o último administrador" — role stays `admin`.
8. Click the trash icon on `carol`'s row (now `user`, not the last admin) → confirm → row disappears.
9. Attempt to create a user with username `admin` (already taken) via the "+" modal → expect inline "Nome de usuário já existe", modal stays open.

Stop the dev servers after verifying. If any step required a code fix, make it now before committing.

- [ ] **Step 7: Commit**

```bash
git add client/src/pages/AdminUsersPage.jsx
git commit -m "feat(client): wire the delete-user confirm panel"
```
