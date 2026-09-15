# Seduc Audit

Login screen + admin-only user registration screen.

## Setup

```bash
npm install
npm install --prefix server
npm install --prefix client
cp server/.env.example server/.env
# Edit server/.env: set JWT_SECRET to a long random value and change ADMIN_PASS from the default.
npm run seed
npm run dev
```

Then open http://localhost:5173/login. Seeded admin credentials are in `server/.env` (`ADMIN_USER` / `ADMIN_PASS`).
