# Discord Clone (React + Express + Prisma)

A production-leaning Discord-style full-stack app built with:

- React + TypeScript + Vite + Tailwind CSS
- Express + TypeScript API
- PostgreSQL + Prisma ORM
- JWT auth + role-based access
- Socket.IO real-time messaging and voice signaling
- Cloudinary file upload endpoint

## Project Structure

```
discord protype/
  client/   # React frontend
  server/   # Express API + Prisma
```

## Environment Setup

### 1) Server env

Copy `server/.env.example` to `server/.env` and fill values:

- `DATABASE_URL`: PostgreSQL connection
- `JWT_SECRET`: secure random secret
- `CLIENT_URL`: frontend URL
- Cloudinary keys for upload support

### 2) Client env

Copy `client/.env.example` to `client/.env`.

## Install

From repo root:

```bash
npm install
```

## Database Migration Steps

1. Ensure Postgres is running and `DATABASE_URL` is correct.
2. Generate Prisma client:

```bash
npm run prisma:generate -w server
```

3. Run migrations:

```bash
npm run prisma:migrate -w server -- --name init
```

## Run Locally

### Start both apps

```bash
npm run dev
```

- API: `http://localhost:4000`
- Web: `http://localhost:5173`

## Implemented Core Features

- Email/password auth (`/api/auth/register`, `/api/auth/login`)
- Protected profile endpoint (`/api/auth/me`)
- Profile update endpoint (`/api/auth/profile`)
- Server CRUD foundation (create/list/join by invite)
- Channel create/list with role checks
- Real-time chat message create/edit/delete
- Message pagination endpoint
- Voice channel signaling events over Socket.IO
- File upload endpoint (`/api/upload`)
- Discord-style dark UI with server/channel/chat layout

## Production Notes

- Add refresh-token strategy, email verification, and OAuth callback flow for full auth hardening.
- Add Redis adapter for Socket.IO horizontal scaling.
- Add centralized structured logging (Pino) and observability (OpenTelemetry).
- Add input validation middleware (Zod) to all routes.
- Move secrets to secure secret manager in deployment.
