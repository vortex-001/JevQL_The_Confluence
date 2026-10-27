# JevQL Phase 1 Frontend — Tushar

This is a scoped frontend package for Phase 1 only:
- Landing page
- Login page
- Registration page
- Protected starter dashboard
- Shared auth context, API client, toast context and styles

Search, datasets, analytics, query history, integrations and settings pages are intentionally excluded.

## Install and run
From the repository root:
```powershell
cd frontend
npm install
npm run dev
```

Set `VITE_API_BASE_URL=http://127.0.0.1:8000` in `frontend/.env.local` if the API is on a separate origin. Do not commit `.env.local`.

Expected backend endpoints:
- POST `/api/auth/register/`
- POST `/api/auth/login/`
- POST `/api/auth/logout/`
- GET `/api/auth/me/`
- GET `/api/dashboard/overview/`

Note: source has been scoped for Phase 1; run `npm run build` after extraction to verify compatibility with the local Node.js version.
