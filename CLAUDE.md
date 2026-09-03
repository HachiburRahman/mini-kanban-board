# mini-kanban-board

NestJS + Prisma/Postgres backend (`backend/`, port 4000) and a Next.js 16 +
Tailwind 4 frontend (`frontend/`, port 3000). `docker-compose.yml` brings up
all three services including Postgres.

## Testing

Vitest, in both workspaces. See [TESTING.md](TESTING.md) for the full guide.

```bash
cd backend  && npm test
cd frontend && npm test
```

- Backend tests: `backend/test/*.test.ts` (node environment)
- Frontend tests: `frontend/test/*.test.{ts,tsx}` (jsdom + @testing-library/react)
- CI: `.github/workflows/test.yml` runs both suites on push and PR

Expectations:

- 100% test coverage is the goal. Tests make vibe coding safe.
- New function → write a corresponding test.
- Bug fix → write a regression test that fails before the fix.
- New error handling → write a test that triggers the error.
- New conditional (`if`/`else`, `switch`) → write tests for **both** paths.
- Never commit code that makes existing tests fail.

## Dependency note

`npm install` in `backend/` needs `--legacy-peer-deps`: `@nestjs/config@4`
declares a peer of `@nestjs/common@^10 || ^11`, but this project runs NestJS 12.

## Skill routing

When the user's request matches an available skill, invoke it via the Skill tool. When in doubt, invoke the skill.

Key routing rules:
- Product ideas/brainstorming → invoke /office-hours
- Strategy/scope → invoke /plan-ceo-review
- Architecture → invoke /plan-eng-review
- Design system/plan review → invoke /design-consultation or /plan-design-review
- Full review pipeline → invoke /autoplan
- Bugs/errors → invoke /investigate
- QA/testing site behavior → invoke /qa or /qa-only
- Code review/diff check → invoke /review
- Visual polish → invoke /design-review
- Ship/deploy/PR → invoke /ship or /land-and-deploy
- Save progress → invoke /context-save
- Resume context → invoke /context-restore
- Author a backlog-ready spec/issue → invoke /spec
