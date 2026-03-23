# Workspace

## Overview

pnpm workspace monorepo using TypeScript. This is a **Focus Room – Virtual Study Space** application — a real-time productivity tool for students to study together in virtual rooms with synchronized Pomodoro timers.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **Frontend**: React 19 + Vite (artifacts/focus-room)
- **Backend**: Express 5 + Node.js (artifacts/api-server)
- **Real-time**: Socket.IO (namespace: root `/`, path: `/api/socket.io`)
- **Database**: PostgreSQL + Drizzle ORM
- **Auth**: JWT (jsonwebtoken + bcryptjs), token stored in localStorage as `focus_room_token`
- **State management**: Zustand
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Animations**: Framer Motion
- **Charts**: Recharts

## Features

- **Authentication**: JWT-based register/login/profile
- **Virtual Study Rooms**: Create/join public and private rooms with password protection
- **Synchronized Pomodoro Timer**: Real-time timer sync via Socket.IO (host controls start/pause/skip/reset)
- **Room Chat**: Real-time message exchange within rooms
- **Dashboard**: Study stats (daily/weekly/monthly), progress charts, session history, streak counter
- **Leaderboard**: Top focused users by period (daily/weekly/monthly/alltime)
- **Dark Mode**: Full dark theme with calming navy/purple/teal palette

## Structure

```text
artifacts-monorepo/
├── artifacts/
│   ├── api-server/         # Express API server with Socket.IO
│   └── focus-room/         # React + Vite frontend
├── lib/
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   └── db/                 # Drizzle ORM schema + DB connection
├── scripts/                # Utility scripts
├── pnpm-workspace.yaml
└── tsconfig.json
```

## Database Schema

- **users** — id, username, email, passwordHash, avatar, theme, studyGoalMinutes, totalFocusMinutes, currentStreak, longestStreak, lastStudyDate
- **rooms** — id, name, description, category, isPrivate, passwordHash, maxParticipants, background, focusDuration, breakDuration, hostId, timerState (jsonb)
- **room_participants** — roomId, userId, joinedAt, isHost (composite PK)
- **study_sessions** — id, userId, roomId, startTime, endTime, durationMinutes, pomodorosCompleted, completed

## API Routes

All routes under `/api`:
- `GET /healthz` — Health check
- `POST /auth/register` — Register user
- `POST /auth/login` — Login
- `GET /auth/me` — Current user (auth required)
- `PATCH /auth/profile` — Update profile (auth required)
- `GET /rooms` — List public rooms (auth required)
- `POST /rooms` — Create room (auth required)
- `GET /rooms/:id` — Room detail (auth required)
- `POST /rooms/:id/join` — Join room (auth required)
- `POST /rooms/:id/leave` — Leave room (auth required)
- `POST /rooms/:id/timer` — Update timer (host only, auth required)
- `DELETE /rooms/:id` — Delete room (host only, auth required)
- `GET /sessions` — User sessions (auth required)
- `POST /sessions` — Start session (auth required)
- `POST /sessions/:id/complete` — Complete session (auth required)
- `GET /dashboard` — Dashboard stats (auth required)
- `GET /dashboard/activity` — Activity data (auth required)
- `GET /leaderboard` — Leaderboard (auth required)

## Socket.IO Events

Connect to: `io("/", { path: "/api/socket.io", auth: { token } })`

Emit:
- `join-room(roomId)` — Join room socket channel
- `leave-room(roomId)` — Leave room socket channel
- `send-message({ roomId, content })` — Send chat message
- `timer-action({ roomId, action })` — Control timer (host only): start/pause/reset/skip

Listen:
- `room-state(data)` — Initial room state with participants and timer
- `user-joined(user)` — Someone joined the room
- `user-left(userId)` — Someone left the room
- `message(msg)` — Chat message received
- `timer-update(timerState)` — Timer state changed

## Running Locally

- **API Server**: `pnpm --filter @workspace/api-server run dev`
- **Frontend**: `pnpm --filter @workspace/focus-room run dev`
- **DB migrations**: `pnpm --filter @workspace/db run push`
- **Codegen**: `pnpm --filter @workspace/api-spec run codegen`

## Environment Variables

- `DATABASE_URL` — PostgreSQL connection string (auto-provisioned by Replit)
- `PORT` — Server port (auto-assigned by Replit per service)
- `JWT_SECRET` — JWT signing secret (defaults to dev value, set in production)
