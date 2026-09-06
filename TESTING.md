# Testing

The suite concentrates on the parts of this app that are genuinely easy to get
wrong: fractional-index ordering, board access control, and the index contract
between the drag-and-drop UI and the move API. Those are pulled out into pure
functions precisely so they can be tested without a database or a browser.

## Framework

[Vitest](https://vitest.dev) 3.x, in both `backend/` and `frontend/`.

- **backend** — `environment: node`. NestJS providers are constructed directly
  with fake dependencies rather than through `Test.createTestingModule`, which
  keeps unit tests fast and free of Prisma/DB setup.
- **frontend** — `environment: jsdom`, with `@testing-library/react` and
  `@testing-library/jest-dom` matchers wired up in `test/setup.ts`. There is no
  `@vitejs/plugin-react`; esbuild's automatic JSX runtime (`esbuild.jsx` in
  `vitest.config.ts`) handles `.tsx` on its own.

## Running tests

```bash
cd backend  && npm test        # one-shot
cd backend  && npm run test:watch
cd frontend && npm test
cd frontend && npm run test:watch
```

CI runs both suites on every push and pull request via
`.github/workflows/test.yml`.

## Layout

| Location | Contains |
|---|---|
| `backend/test/*.test.ts` | Backend unit tests |
| `frontend/test/*.test.ts(x)` | Frontend unit and component tests |
| `frontend/test/setup.ts` | jest-dom matchers, auto-cleanup between tests |

## Test layers

- **Unit** — a single service or module with every dependency faked. Prisma,
  bcrypt-backed lookups, JWT signing, and `fetch` are all mocked. This is where
  most tests belong.
- **Integration** — a controller plus its service, or an API client plus a
  stubbed `fetch`. Use when the contract between two units is the risk.
- **Component** — a React component rendered into jsdom with
  `@testing-library/react`, driven through `user-event`. Assert what the user
  sees, not internal state.
- **E2E / smoke** — exploratory, against a real browser and a running stack
  (`docker compose up`). Anything it turns up becomes a unit test below, so the
  bug cannot come back silently. Reach for a dedicated E2E runner only once
  that stops scaling.

## Conventions

- **File naming** — `<subject>.test.ts`. Tests written for a specific defect
  use `<subject>.regression-<n>.test.ts` and open with a comment naming the
  issue id, when it was found, and what the broken behaviour actually was.
- **Assertions** — assert real behaviour. `expect(x).toBeDefined()` is not a
  test. Assert the value that was computed, the exception type that was
  thrown, or the argument a dependency was called with.
- **Mocking** — mock at the boundary (Prisma client, `fetch`, `JwtService`).
  Do not mock the unit under test.
- **Setup** — build fixtures with a local `makeService(...)` helper per file so
  each test states only the state it cares about.
- **Secrets** — never import API keys, credentials, or `.env` values into a
  test. Use literals or environment variables.

## Expectations for new code

- New function → a test for it.
- Bug fix → a regression test that fails before the fix and passes after.
- New error handling → a test that triggers the error path.
- New conditional → a test for **both** branches.
- Never commit code that makes an existing test fail.
