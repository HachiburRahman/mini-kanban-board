# Mini Kanban Board

A small collaborative kanban board: users register, create boards, share them
with other registered users, organize workflow columns, and manage tasks with
drag-and-drop reordering. Built for the Webbriks full-stack technical
assessment.

## Tech stack

| Layer    | Tech                                              |
| -------- | -------------------------------------------------- |
| Frontend | Next.js (App Router) + React + TypeScript + Tailwind CSS + dnd-kit |
| Backend  | NestJS + TypeScript                                |
| Database | PostgreSQL + Prisma                                |
| DevOps   | Docker / docker-compose                            |

## Architecture at a glance

```
Browser --(REST + JWT bearer)--> NestJS API --(Prisma)--> PostgreSQL
```

- **Auth**: JWT-based. `POST /auth/register` and `POST /auth/login` return an
  `accessToken`; the frontend sends it as `Authorization: Bearer <token>`.
- **Access control**: every board/column/task route resolves the board the
  resource belongs to and checks the requesting user is either the board's
  owner or a shared member. A board that doesn't exist and a board the user
  can't access both come back as `404` (not `403`) so board ids can't be
  enumerated.
- **Task ordering**: `Column.position` and `Task.position` are floats
  (fractional indexing), so moving a task just needs the average of its two
  new neighbours' positions - no renumbering the rest of the column. The
  read-then-write for a move runs inside a `SERIALIZABLE` Postgres
  transaction with automatic retry, so two people dragging cards on the same
  board at the same time can't corrupt the order.

## Option A - run everything with Docker (recommended)

Requires Docker Desktop (with Docker Compose) running locally.

1. Copy the root env file and, optionally, edit the JWT secret:
   ```bash
   cp .env.example .env
   ```
2. From the repository root:
   ```bash
   docker compose up --build
   ```
3. Once it's up:
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:4000

   The backend container automatically runs `prisma migrate deploy` against
   the `postgres` container before starting, so the database schema is
   created for you on first run.

To stop everything: `docker compose down` (add `-v` to also drop the
database volume and start fresh next time).

## Option B - run without Docker

Requires Node.js 22+, npm, and a PostgreSQL server you can connect to.

### 1. Database

Create a database and note its connection string, e.g. for a local Postgres:

```bash
createdb kanban
```

### 2. Backend

```bash
cd backend
cp .env.example .env      # edit DATABASE_URL / JWT_SECRET if needed
npm install --legacy-peer-deps
npx prisma migrate dev    # creates the tables
npm run start:dev         # http://localhost:4000
```

`backend/.env.example`:

```
DATABASE_URL="postgresql://kanban:kanban@localhost:5432/kanban?schema=public"
JWT_SECRET="replace-with-a-long-random-string"
JWT_EXPIRES_IN="7d"
PORT=4000
```

### 3. Frontend

In a second terminal:

```bash
cd frontend
cp .env.example .env
npm install --legacy-peer-deps
npm run dev                # http://localhost:3000
```

`frontend/.env.example`:

```
NEXT_PUBLIC_API_URL="http://localhost:4000"
```

> Note: `--legacy-peer-deps` is there because this project uses very recent
> major versions of NestJS/Next/Prisma whose peer dependency ranges npm's
> resolver is sometimes stricter about than necessary; it's safe here.

## API overview

| Method | Path                              | Description                                   |
| ------ | ---------------------------------- | ---------------------------------------------- |
| POST   | `/auth/register`                   | Create an account, returns a JWT               |
| POST   | `/auth/login`                      | Log in, returns a JWT                          |
| GET    | `/boards`                          | List boards you own or are a member of         |
| POST   | `/boards`                          | Create a board (you become the owner)          |
| GET    | `/boards/:id`                      | Board detail with columns + tasks              |
| PATCH  | `/boards/:id`                      | Rename a board (owner only)                    |
| DELETE | `/boards/:id`                      | Delete a board (owner only)                    |
| POST   | `/boards/:id/share`                | Share a board with a registered user's email (owner only) |
| DELETE | `/boards/:id/members/:userId`      | Remove a member (owner only)                   |
| POST   | `/boards/:boardId/columns`         | Create a column                                |
| PATCH  | `/columns/:id`                     | Rename a column                                |
| DELETE | `/columns/:id`                     | Delete a column (and its tasks)                |
| POST   | `/columns/:columnId/tasks`         | Create a task                                  |
| PATCH  | `/tasks/:id`                       | Edit a task's title/description                |
| DELETE | `/tasks/:id`                       | Delete a task                                  |
| POST   | `/tasks/:id/move`                  | Move a task - see below                        |

All routes except `/auth/*` require `Authorization: Bearer <token>`.

### Task movement

```
POST /tasks/:id/move
{ "columnId": "<optional target column id>", "index": 2 }
```

- Omit `columnId` to reorder within the task's current column.
- Include it to move the task into a different column on the same board.
- `index` is the 0-based position the task should land at among the target
  column's *other* tasks (i.e. not counting the task being moved) - exactly
  what a drag-and-drop UI already knows once a card is dropped.

## Known limitations / possible next steps

- No password reset flow.
- No real-time sync between browser tabs/users (a board has to be reloaded
  to see another member's changes) - a natural next step would be a
  WebSocket or SSE channel per board.
- Fractional positions are simple and fast, but after a very large number of
  inserts at the same spot, floating-point precision could theoretically run
  out; a periodic rebalancing pass would fix that in a longer-lived system.
