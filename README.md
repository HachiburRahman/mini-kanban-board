# Mini Kanban Board

A small collaborative kanban board: users register, create boards, share them
with other registered users, organize workflow columns, and manage tasks with
drag-and-drop reordering. Boards, columns and cards can all be created,
renamed, reordered and deleted from the UI. Built for the Webbriks full-stack
technical assessment.

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
- **Ordering**: `Column.position` and `Task.position` are floats (fractional
  indexing), so moving an item just needs the average of its two new
  neighbours' positions - no renumbering the rest of the list. The
  read-then-write for a move runs inside a `SERIALIZABLE` Postgres
  transaction with automatic retry, so two people dragging cards on the same
  board at the same time can't corrupt the order.
- **Ordering, the part that bites**: halving a gap on every drop into the same
  slot shrinks `position` geometrically - repeated drops at the top of a column
  took it from 1024 to ~7e-18 in 120 moves, and it reaches 0 (where `after / 2`
  is also 0, and cards silently tie) at around 1080. So a move that would split
  a gap below `1e-4` renumbers the whole list onto fresh 1024-spaced positions
  inside the same transaction instead. The arithmetic lives in
  `backend/src/common/ordering.ts` and is shared by tasks and columns.

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

## Tests

```bash
cd backend  && npm test    # 97 tests
cd frontend && npm test    # 105 tests
```

Both suites run on every push and pull request
(`.github/workflows/test.yml`). See [TESTING.md](TESTING.md) for what is
covered where and why.

## API overview

| Method | Path                              | Description                                   |
| ------ | ---------------------------------- | ---------------------------------------------- |
| GET    | `/` and `/health`                  | Health payload (`status`, `database`, `uptime`) |
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
| POST   | `/columns/:id/move`                | Reorder a column within its board              |
| POST   | `/columns/:columnId/tasks`         | Create a task                                  |
| PATCH  | `/tasks/:id`                       | Edit a task's title/description                |
| DELETE | `/tasks/:id`                       | Delete a task                                  |
| POST   | `/tasks/:id/move`                  | Move a task - see below                        |

All routes except `/`, `/health` and `/auth/*` require
`Authorization: Bearer <token>`. `/auth/register` and `/auth/login` are rate
limited per IP (10/min and 20/min) - they are the only routes an
unauthenticated caller can reach, so they are the only ones worth hammering.
Over the limit the API answers `429` and the UI says so in plain words.

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

Moving a task to a column on a different board is rejected with `400`.

### Column movement

```
POST /columns/:id/move
{ "index": 0 }
```

Same index contract, same ordering machinery - a column never leaves its board,
so there is no `boardId` to pass.

## Accessibility

Drag and drop is not the only way to move a card. Focus one and hold
<kbd>Ctrl</kbd> (or <kbd>Cmd</kbd>) with the arrow keys: left/right carries it
to the neighbouring column, up/down reorders it in place. It calls the same
`POST /tasks/:id/move` the drag does.

This exists because dnd-kit's `KeyboardSensor` cannot do it. The sensor reads
the lane's live geometry after the coordinate getter returns and, when the
requested x sits past the scroll container's midpoint, scrolls the lane
*instead of* moving the card. The board lane is always horizontally scrollable
(it is capped at `max-w-7xl`), so that branch fires for any column not already
at the left edge. Expressing the move as an index rather than as simulated
pointer coordinates sidesteps the problem entirely and works with empty
columns, which the coordinate approach never did.

Drag announcements name the card, the column and the position rather than
reading out record ids, and keyboard moves get their own live region.

## Known limitations / possible next steps

- No password reset flow.
- No real-time sync between browser tabs/users (a board has to be reloaded
  to see another member's changes) - a natural next step would be a
  WebSocket or SSE channel per board.
- Sharing is a single role: a member can do everything on a board except
  rename it, delete it, or change who else has access. A read-only role would
  be the obvious next addition.
- Columns are reordered from the column menu rather than by dragging. Task
  drag-and-drop was the requirement and mixing two sortable axes in one
  `DndContext` earns real complexity, so this is a deliberate trade.
- The Docker images are single-stage and carry dev dependencies (~1.1-1.4GB).
  Fine for a local review; a multi-stage build with `npm ci --omit=dev` and
  Next's `standalone` output would cut them by roughly an order of magnitude.
- Not deployed anywhere - the assessment lists deployment as optional, and
  `docker compose up --build` is the intended way to see it running.
