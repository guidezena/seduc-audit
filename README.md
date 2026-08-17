# Auth App

Login screen + admin-only user registration screen.

## Setup

```bash
npm install
npm install --prefix server
npm install --prefix client
cp server/.env.example server/.env
npm run seed
npm run dev
```

Then open http://localhost:5173/login. Seeded admin credentials are in `server/.env` (`ADMIN_USER` / `ADMIN_PASS`).
