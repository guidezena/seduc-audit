# Auth App — Login & Admin User Registration

**Date:** 2026-08-17
**Status:** Approved

## Purpose

A minimal full-stack app with two screens:

1. A login screen (username + password) for any registered user.
2. An admin-only screen to register new users (username, password, role).

There is no public self-signup — only an authenticated admin can create accounts.

## Scope

In scope:
- Login screen + login API
- Admin registration screen + registration API
- Minimal backend with SQLite persistence and JWT-based auth
- A seed script to bootstrap the first admin account

Out of scope (explicitly not building):
- Dashboards, user listing/management UI beyond the registration form
- Password reset / forgot password flow
- Email verification
- Automated test suite (manual verification only, per user's choice)

## Architecture

Single repository, two packages:

- `client/` — React app (Vite)
- `server/` — Node.js + Express API, SQLite database (via `better-sqlite3`)

The client talks to the server over REST (`/api/*`), proxied through Vite's dev server during development.

## Data Model

Table `users`:

| column        | type    | notes                          |
|---------------|---------|---------------------------------|
| id            | INTEGER | primary key, autoincrement      |
| username      | TEXT    | unique, not null                |
| password_hash | TEXT    | bcrypt hash, not null           |
| role          | TEXT    | `admin` \| `user`, not null     |
| created_at    | TEXT    | ISO timestamp, default now      |

## Auth Flow

- `POST /api/login` — body `{ username, password }`. Verifies password with bcrypt. On success, issues a JWT (contains `id`, `username`, `role`) set as an `httpOnly` cookie. On failure, returns 401 with a generic "invalid credentials" message (no distinguishing between "user not found" and "wrong password").
- `requireAuth` middleware — reads the JWT cookie, verifies it, attaches `req.user`. Returns 401 if missing/invalid/expired.
- `requireAdmin` middleware — runs after `requireAuth`; returns 403 if `req.user.role !== 'admin'`.
- `POST /api/register` — protected by `requireAuth` + `requireAdmin`. Body `{ username, password, role }`. Validates username uniqueness and minimum password length (8 chars). Hashes password with bcrypt before storing. Returns the created user (without password hash).
- `POST /api/logout` — clears the auth cookie.
- `GET /api/me` — protected by `requireAuth`; returns the current user's `{ id, username, role }`. Used by the client to decide whether to render the admin registration screen.

## Screens

### Login (`/login`)
- Fields: username, password.
- Client-side validation: both required.
- On submit, calls `POST /api/login`. On success, redirects to `/admin/register` if the user is an admin, otherwise shows a simple "logged in" confirmation (no further screens are in scope).
- On failure, shows the server's error message inline.

### Admin Registration (`/admin/register`)
- On mount, calls `GET /api/me`. If not authenticated or not admin, redirects to `/login`.
- Fields: username, password, confirm password, role (select: `user` / `admin`).
- Client-side validation: all required, password === confirm password, password length ≥ 8.
- On submit, calls `POST /api/register`. On success, clears the form and shows a success message. On failure (e.g. duplicate username), shows the server's error message inline.

## Bootstrapping the First Admin

Since only an admin can create users, and the database starts empty, `server/` includes a `npm run seed` script that:
- Reads `ADMIN_USER` / `ADMIN_PASS` from the environment, falling back to `admin` / `changeme123` if unset.
- Creates that user with role `admin` if a user with that username doesn't already exist.
- Prints the created username (never the password) to the console.

## Error Handling Summary

| Scenario                          | Behavior                                      |
|------------------------------------|------------------------------------------------|
| Wrong username/password on login   | 401, generic "invalid credentials"             |
| Duplicate username on registration | 409, "username already exists"                 |
| Password too short                 | 400, validation message (checked client + server) |
| Missing/expired auth cookie        | 401 on API; client redirects to `/login`       |
| Non-admin hits `/admin/register`   | 403 on API; client redirects to `/login`       |

## Testing

Manual verification only (no automated test suite requested):
1. Run seed script, confirm admin created.
2. Log in as seeded admin → redirected to registration screen.
3. Register a new `user` account → success message shown.
4. Log out, log in as the new `user` → confirmed login, no access to `/admin/register` (redirects to `/login`).
5. Attempt login with wrong password → inline error shown.
6. Attempt to register a duplicate username while logged in as admin → inline error shown.
