# Document Monorepo

Collaborative document editor with a React/Vite frontend, an Express + WebSocket backend, and Prisma for PostgreSQL.

## Project Structure

- `frontend/`: Vite app for the editor UI
- `backend/`: Express API, WebSocket server, Prisma schema, and mail/auth logic
- `docker-compose.yml`: local development stack with frontend, backend, and Postgres
- `.env.production.example`: sample production variables for Render + Vercel + Neon

## Local Run

### Option 1: Docker

From the repo root:

```powershell
docker compose up -d
```

Open:

- Frontend: `http://localhost:5173`
- Backend health: `http://localhost:4000/health`

If you change `Dockerfile`, `package.json`, or `package-lock.json`, rebuild first:

```powershell
docker compose build
docker compose up -d
```

Stop the stack:

```powershell
docker compose down
```

### Option 2: Run without Docker

Backend:

```powershell
cd backend
npm install
npx prisma generate
npx prisma db push
npm run dev
```

Frontend:

```powershell
cd frontend
npm install
npm run dev
```

## Required Env Vars

### Backend

See [`backend/.env.example`](/c:/Users/USER/Documents/GitHub/document/backend/.env.example).

- `HOST`
- `PORT`
- `DATABASE_URL`
- `FRONTEND_ORIGIN`
- `PDF_EXPORT_ENABLED`
- `PUPPETEER_EXECUTABLE_PATH`
- `GOOGLE_CLIENT_ID`
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_SECURE`
- `SMTP_USER`
- `SMTP_PASS`
- `SMTP_FROM`

### Frontend

See [`frontend/.env.example`](/c:/Users/USER/Documents/GitHub/document/frontend/.env.example).

- `VITE_API_URL`
- `VITE_WS_URL`
- `VITE_DOC_ROOM`
- `VITE_GOOGLE_CLIENT_ID`

## Neon Setup

1. Create a Neon Postgres project.
2. Copy the pooled or direct Prisma connection string.
3. Make sure the connection string includes TLS, for example `?sslmode=require`.
4. Set that string as `DATABASE_URL` in Render.
5. Prisma is configured in [`backend/prisma/schema.prisma`](/c:/Users/USER/Documents/GitHub/document/backend/prisma/schema.prisma) to read only from `env("DATABASE_URL")`.

## Render Backend Deploy

Deploy the backend as a Render Web Service.

- Service type: `Web Service`
- Root directory: `backend`
- Build command: `npm install && npx prisma generate`
- Start command: `npm run prisma:migrate && npm start`

Alternative package script:

- Start command: `npm run start:prod`

Render env vars:

- `HOST=0.0.0.0`
- `PORT=10000`
- `DATABASE_URL=postgresql://USER:PASSWORD@HOST/DB?sslmode=require`
- `FRONTEND_ORIGIN=https://your-frontend.vercel.app`
- `PDF_EXPORT_ENABLED=true`
- `PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser`
- `GOOGLE_CLIENT_ID=...`
- `SMTP_HOST=...`
- `SMTP_PORT=587`
- `SMTP_SECURE=false`
- `SMTP_USER=...`
- `SMTP_PASS=...`
- `SMTP_FROM=Docs Share <you@example.com>`

Notes:

- The backend binds to `0.0.0.0` and uses `process.env.PORT`, which is required for Render public traffic.
- Use Prisma migrations in production with `prisma migrate deploy`.
- Do not use `db push` in production startup paths.
- Render provides HTTPS automatically for the generated `onrender.com` domain and custom domains.
- Health check endpoint: `/health` returns `{ "status": "ok" }` when the API and database are reachable.
- PDF export needs a Chromium binary. If Render does not provide one, set `PDF_EXPORT_ENABLED=false` or configure `PUPPETEER_EXECUTABLE_PATH`.

## Vercel Frontend Deploy

Deploy the frontend as a Vercel project.

- Root directory: `frontend`
- Build command: `npm run build`
- Output directory: `dist`

Vercel env vars:

- `VITE_API_URL=https://your-api.onrender.com`
- `VITE_WS_URL=wss://your-api.onrender.com/ws`
- `VITE_DOC_ROOM=demo-document`
- `VITE_GOOGLE_CLIENT_ID=...`

Notes:

- Production builds require `VITE_API_URL`.
- Production builds require `VITE_WS_URL`.
- Use `https://` for API traffic and `wss://` for WebSocket traffic.
- `VITE_WS_URL` must include the `/ws` path.

## Production URLs

Example production setup:

- Frontend: `https://your-frontend.vercel.app`
- Backend API: `https://your-api.onrender.com`
- Backend WebSocket: `wss://your-api.onrender.com/ws`
- Database: Neon Postgres

## Deployment Architecture

- Frontend: Vercel
- Backend: Render Web Service
- Database: Neon Postgres
- Secrets: environment variables only

This keeps the repo clean and avoids committing production secrets.
