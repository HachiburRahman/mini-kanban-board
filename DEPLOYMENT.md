# Deploying for free

Three free accounts, no credit card, no expiry:

| Piece | Host | Free tier |
| --- | --- | --- |
| PostgreSQL | [Neon](https://neon.com) | 0.5 GB storage, always free |
| API (NestJS) | [Render](https://render.com) | Free web service; sleeps after 15 min idle |
| Web app (Next.js) | [Vercel](https://vercel.com) | Hobby plan, always free |

Do them in this order - each step needs a URL produced by the one before it.

---

## 1. Database - Neon

1. Sign up at [neon.com](https://neon.com) with GitHub.
2. **Create project** - name it `mini-kanban-board`, pick the region closest
   to you, keep the default Postgres version.
3. On the project dashboard, copy the **connection string**. It looks like:

   ```
   postgresql://USER:PASSWORD@ep-xxx-xxx.region.aws.neon.tech/neondb?sslmode=require
   ```

   Use the **pooled** connection string if Neon offers both - it handles the
   API reconnecting after each cold start better.

Keep that string handy; Render needs it next. You don't have to run any SQL:
the migration in `backend/prisma/migrations/` creates every table on first
deploy.

---

## 2. API - Render

The repo ships a Blueprint (`render.yaml`), so Render can read the whole
service config instead of you filling in a form.

1. Sign up at [render.com](https://render.com) with GitHub and grant it access
   to the `mini-kanban-board` repo.
2. **New > Blueprint**, select the repo, click **Connect**.
3. Render reads `render.yaml` and asks for the two secrets marked `sync: false`:
   - `DATABASE_URL` - the Neon string from step 1.
   - `FRONTEND_URL` - you don't have the Vercel URL yet. Put
     `http://localhost:3000` for now and correct it in step 4.

   `JWT_SECRET` is generated for you; `PORT` is injected by Render.
4. **Apply**. The first build takes 3-5 minutes: it installs, generates the
   Prisma client, applies migrations to Neon, then compiles Nest.
5. When it goes live, copy the service URL
   (`https://mini-kanban-api.onrender.com`) and open `/health` in a browser.
   You want:

   ```json
   { "status": "ok", "service": "mini-kanban-board-api", "database": "up", "uptime": 3 }
   ```

   `"database": "down"` means the Neon string is wrong or missing `sslmode=require`.

---

## 3. Web app - Vercel

1. Sign up at [vercel.com](https://vercel.com) with GitHub.
2. **Add New > Project**, import `mini-kanban-board`.
3. Two settings matter:
   - **Root Directory**: `frontend` (click Edit and select the folder - the
     repo root has no package.json, so the build fails without this).
   - **Environment Variables**: add `NEXT_PUBLIC_API_URL` =
     `https://mini-kanban-api.onrender.com` (your Render URL, **no trailing
     slash**).

   Framework preset, build command and output directory are auto-detected.
4. **Deploy**, then copy the production URL, e.g.
   `https://mini-kanban-board.vercel.app`.

> `NEXT_PUBLIC_*` variables are compiled into the browser bundle at build
> time. Changing one later means **redeploying** the frontend, not just
> saving the variable.

---

## 4. Close the CORS loop

The API still trusts `localhost`. In Render: **your service > Environment >
`FRONTEND_URL`**, set it to the Vercel production URL and save. Render
restarts the service automatically.

To also allow Vercel's per-branch preview deployments, list them
comma-separated:

```
https://mini-kanban-board.vercel.app,https://mini-kanban-board-git-dev-yourname.vercel.app
```

Open the Vercel URL, register an account, create a board. If register hangs,
it's the Render cold start - see below.

---

## What "free" costs you

- **Cold starts.** Render spins a free service down after 15 minutes without
  traffic. The next request wakes it, which takes **roughly 50 seconds**. The
  first login after an idle period looks like a hang. Everything is fast once
  it is awake.
- **750 instance-hours/month** on Render across all free services - one
  service that sleeps stays well inside it.
- **Neon** sleeps its compute after 5 minutes idle too, but wakes in under a
  second, so it is not what you'll notice.
- Neon's free branch has **0.5 GB** of storage. This schema stores text rows;
  you will not approach it.

If the cold start is unacceptable for a demo, the cheapest fix is Render's
$7/month Starter plan, which never sleeps. Do not use an uptime pinger to keep
a free service awake - it burns your instance-hours and Render's terms
disallow it.

---

## Redeploying

Both hosts watch the `main` branch: `git push` triggers a rebuild on Render
and Vercel. Schema changes need a migration committed to
`backend/prisma/migrations/` - Render's build command runs
`prisma migrate deploy` on every deploy.

## Troubleshooting

| Symptom | Cause |
| --- | --- |
| Login/register fails, console shows a CORS error | `FRONTEND_URL` on Render doesn't exactly match the Vercel origin (trailing slash, or `http` vs `https`) |
| Every API call is `ERR_CONNECTION_REFUSED` to `localhost:4000` | `NEXT_PUBLIC_API_URL` wasn't set at build time - set it, then redeploy on Vercel |
| Vercel build: `No package.json found` | Root Directory isn't set to `frontend` |
| Render build fails at `prisma migrate deploy` | `DATABASE_URL` unset or unreachable; check the Neon string includes `?sslmode=require` |
| `/health` returns `"database": "down"` | Same as above - the API is up, Postgres isn't reachable |
| First request after a break takes ~50 s | Expected on Render free. Not a bug. |
