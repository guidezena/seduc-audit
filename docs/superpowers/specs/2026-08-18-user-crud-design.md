# Auth App — Admin User Management (CRUD)

**Date:** 2026-08-18
**Status:** Approved

## Purpose

Replace the admin's "register a new user" screen with a full user-management
screen: an admin can list every user, create a new one, view a user's
details, edit a user (username, role, optionally reset password), and delete
a user. This builds on `docs/superpowers/specs/2026-08-17-auth-app-design.md`
(the original login + registration app) — that spec's data model, auth flow,
and login screen are unchanged and still apply.

## Scope

In scope:
- `GET /api/users` — list all users (admin only)
- `PATCH /api/users/:id` — update a user's username, role, and/or password (admin only)
- `DELETE /api/users/:id` — delete a user (admin only), with two safety rules (see below)
- A new admin screen at the existing `/admin/register` route: a table of all
  users with per-row Read / Edit / Delete actions, plus a page-level Create
  action. Replaces the current create-only form.
- Reuses the existing black-text-on-white "Google-style" card/shadow design
  system (`client/src/styles/auth.css`) already in place for `/login` and
  the current `/admin/register`.

Out of scope (explicitly not building):
- Pagination or search/filtering on the user list (fine for a small user base)
- Bulk actions (bulk delete, bulk role change)
- Audit log of who changed what
- Self-service password change (a user changing their own password while
  logged in as themselves, outside the admin panel)
- Automated test suite (manual verification only, consistent with the
  original spec's choice)

## Data Model

No changes to the `users` table (see original spec). `GET /api/users`
returns `id, username, role, created_at` for every row — never
`password_hash`.

## API Changes

All three endpoints below are mounted in `server/src/routes/users.js`
alongside the existing `POST /api/register`, and are protected by the same
`requireAuth` + `requireAdmin` middleware chain already used there.

### `GET /api/users`

No body. Returns `200` with a JSON array, ordered by `id` ascending:

```json
[
  { "id": 1, "username": "admin", "role": "admin", "created_at": "2026-08-17 12:00:00" },
  { "id": 2, "username": "carol", "role": "user", "created_at": "2026-08-17 12:05:00" }
]
```

### `PATCH /api/users/:id`

Body: `{ username?, role?, password? }` — every field is optional; only
supplied fields are updated. At least one field must be present (400 if the
body is empty).

Validation, in order:
- `id` must reference an existing user (404 `{"error":"User not found"}` if not).
- If `username` is supplied: must be a non-empty string; if it collides with
  a *different* user's username, 409 `{"error":"Username already exists"}`.
- If `role` is supplied: must be `"admin"` or `"user"` (400 otherwise, same
  message as the existing register validation). If the target user is
  currently `admin`, `role` is being changed to `"user"`, and they are the
  *only* remaining admin (same `COUNT(*)` check as the delete rule below),
  400 `{"error":"Cannot demote the last remaining admin"}` — demoting the
  last admin is exactly as dangerous as deleting them and gets the same
  protection.
- If `password` is supplied: must be a string of length ≥ 8 (400 otherwise,
  same message as register). It is hashed with bcrypt before storing; the
  plaintext is never logged.

On success, `200` with the updated `{ id, username, role }` (never the hash).

Editing your own account (username/role/password) is allowed — only
*deleting* your own account is blocked (see below). This lets an admin fix
a typo in their own username or rotate their own password from the same
panel.

### `DELETE /api/users/:id`

No body. Validation, in order:
- `id` must reference an existing user (404 `{"error":"User not found"}` if not).
- If `id === req.user.id`: 400
  `{"error":"You cannot delete your own account"}`.
- If the target user's role is `admin` and they are the *only* remaining
  admin (i.e. `SELECT COUNT(*) FROM users WHERE role = 'admin'` is 1): 400
  `{"error":"Cannot delete the last remaining admin"}`.

On success, `200` with `{ "ok": true }`.

## Frontend Changes

### Routing

No new routes. `/admin/register` keeps its path (external links, bookmarks,
and the login redirect all still point here) but the component behind it is
renamed `AdminUsersPage.jsx` (was `AdminRegisterPage.jsx`) since it no
longer just registers — `App.jsx`'s import/route updates accordingly.

### `client/src/api.js` additions

- `listUsers()` → `GET /api/users`
- `updateUser(id, { username, role, password })` → `PATCH /api/users/:id`
  (build the body from only the fields that were actually changed/filled)
- `deleteUser(id)` → `DELETE /api/users/:id`
- `registerUser(...)` (existing) is reused for Create — unchanged.

All four follow the existing `request()` helper's error-translation
behavior (server error strings mapped to Portuguese, `err.status` attached,
401 redirects to `/login` — same pattern already used by the register call).

### `AdminUsersPage.jsx`

On mount: same `getMe()` admin gate as today (redirect to `/login` if not an
authenticated admin), then `listUsers()` to populate the table. Re-fetches
the list after every successful create/update/delete (simplest correct
approach for a small admin-only list — no optimistic local patching).

Layout, inside the existing `.auth-panel` card (widened for the table; see
Styling below):
- Header row: page title ("Gerenciar usuários") + a "Novo usuário" button
  with a plus icon, right-aligned.
- Table: columns Usuário, Papel, Criado em, Ações. Each data row renders
  three icon buttons under Ações: Ler (eye), Editar (pencil), Excluir
  (trash).
- Empty state: if the list is empty (shouldn't normally happen once seeded,
  but the API could theoretically be called against a fresh unseeded DB),
  show "Nenhum usuário cadastrado."

### Modals

Three modal types, all built as a single reusable `Modal` presentational
component (overlay + centered white card, closes on overlay click or an ×
button) so styling stays consistent:

1. **Create** (opens on "Novo usuário"): the exact form that exists today —
   username, password, confirm password, role select. Submits to
   `registerUser`. Client-side: required fields, password === confirm,
   password length ≥ 8 (all pre-existing validation, unchanged).
2. **Read** (opens on the eye icon): read-only — username, role, criado em,
   id. A single "Fechar" button. No API call; renders the row data already
   held in the list state.
3. **Edit** (opens on the pencil icon): username (required), role (select),
   and a "Nova senha" field explicitly labeled optional
   ("deixe em branco para manter a senha atual") with a live indicator that
   min-length 8 only applies if the field is non-empty. Submits to
   `updateUser`, sending only `username`/`role` always and `password` only
   if non-empty.

**Delete** does not use the shared modal — it's a lighter native-feeling
confirm: clicking the trash icon opens a small confirmation panel ("Excluir
o usuário "carol"? Essa ação não pode ser desfeita.") with
Cancelar/Excluir buttons. On confirm, calls `deleteUser`; server-side
blocks (self-delete, last-admin) surface as an inline error in that same
confirm panel rather than closing it, so the admin sees why it failed.

### Icons

Four new inline SVG icons added to `client/src/icons.jsx`, matching the
existing thin-stroke style of `UserIcon`/`LockIcon`/`ShieldIcon`
(`viewBox="0 0 24 24"`, `stroke="currentColor"`, no fill):
`EyeIcon` (read), `PencilIcon` (edit), `TrashIcon` (delete), `PlusIcon`
(create).

## Styling

Reuses `client/src/styles/auth.css`'s existing tokens (`--g-blue`,
`--g-red`, `--g-border`, `--g-card`, `--g-text`, `--g-text-dim`) and the
`.auth-panel` card/shadow treatment — no new color system. New rules added
to the same file:
- `.auth-panel--wide` (or a size variant) for the user-management card,
  since a table needs more horizontal room than the login/create forms
  (~680–760px vs. the current 440px).
- Table styling: light `--g-border` row dividers, `--g-text-dim` for the
  "Criado em" column, `--g-blue` on hover for the row action icons (Ler,
  Editar), `--g-red` for the delete icon.
- Modal overlay: semi-transparent dark scrim
  (`rgba(32, 33, 36, 0.5)`, matching Google's own dialog scrim tone) behind
  a centered `.auth-panel`-styled card.
- The delete confirm panel reuses `.auth-alert`'s red-on-white treatment
  for its warning copy.

## Error Handling Summary (additions to the original spec's table)

| Scenario                                      | Behavior                                                  |
|------------------------------------------------|-------------------------------------------------------------|
| Update: username collides with another user    | 409, "Username already exists" (existing message, reused)  |
| Update: invalid role                            | 400, "Role must be \"admin\" or \"user\"" (existing message) |
| Update: demoting the last remaining admin       | 400, "Cannot demote the last remaining admin"               |
| Update: password supplied but < 8 chars         | 400, "Password must be at least 8 characters" (existing)   |
| Update/Delete: `:id` does not exist             | 404, "User not found"                                       |
| Delete: target is the requesting admin          | 400, "You cannot delete your own account"                  |
| Delete: target is the last remaining admin      | 400, "Cannot delete the last remaining admin"               |

## Testing

Manual verification only (no automated test suite, consistent with the
original spec):
1. Log in as the seeded admin → user-management table loads, shows the
   seeded admin row.
2. Create a new `user` account via the modal → appears in the table after
   the modal closes.
3. Click Ler on that user → read-only modal shows correct data, no API
   call needed to verify (network tab should show none fired).
4. Click Editar → change the role to `admin`, leave password blank, save →
   table reflects the new role; log in as that account afterward to confirm
   the password still works (i.e. it wasn't accidentally cleared).
5. Click Editar again → set a new password → log out, log in as that user
   with the new password → succeeds.
6. Attempt to delete the currently logged-in admin's own row → blocked with
   the inline "cannot delete your own account" message.
7. With only one admin existing, attempt to delete that admin from a
   *different* logged-in admin session (or demote/delete every other admin
   first) → blocked with the "last remaining admin" message.
8. With only one admin existing, attempt to edit that admin's own row and
   change role to `user` → blocked with the "cannot demote the last
   remaining admin" message.
9. Delete a non-admin, non-self user → row disappears from the table.
10. Attempt to create a user with a username that already exists → inline
    "Username already exists" error in the create modal (existing behavior,
    confirm it still works unchanged).
