# GearLoop

GearLoop is a small-team gear checkout board. Browse the shared equipment closet, search and filter
by category or availability, check an item out to a borrower with a due date, return it when it
comes back, and add new gear as the kit grows. Everything lives on one dashboard so the team can
see at a glance what is out, who has it, and what is overdue.

## Stack

- **Frontend:** React 19 + Vite (TypeScript, strict JSX, relative `/api` calls)
- **Backend:** Hono 4 served by Node through `@hono/node-server`
- **Storage:** in-memory and seeded at boot — no database, no external services, no API keys

## Quick start

```bash
npm install
npm run build
npm start
```

Open <http://127.0.0.1:8787>. The Hono process serves both the API and the built frontend from
`dist/`, and the health check is at <http://127.0.0.1:8787/api/health>.

Requires Node 22.13 or newer.

## Development

Run the two processes in separate terminals:

```bash
npm run dev         # Vite dev server on http://localhost:5173
npm run dev:server  # Hono API in watch mode on http://127.0.0.1:8787
```

The Vite dev server proxies every `/api` request to `http://127.0.0.1:8787`, so the frontend always
fetches relative URLs and the same code path is used in development and in production.

## API

| Method | Endpoint                             | Body                                                   | Returns                                 |
| ------ | ------------------------------------ | ------------------------------------------------------ | --------------------------------------- |
| GET    | `/api/health`                        | –                                                      | `{ status: "ok", service: "gearloop" }` |
| GET    | `/api/gear?query=&category=&status=` | –                                                      | `{ items, stats, activity }`            |
| POST   | `/api/gear`                          | `{ name, category, description, location, condition }` | the created item                        |
| POST   | `/api/gear/:id/checkout`             | `{ borrower, dueDate }`                                | the updated item                        |
| POST   | `/api/gear/:id/return`               | –                                                      | the updated item                        |

`query`, `category`, and `status` are optional filters. Unknown ids return `404` and invalid bodies
return `400`.

## Commands

| Command              | What it does                                    |
| -------------------- | ----------------------------------------------- |
| `npm run dev`        | Vite dev server with HMR on port 5173           |
| `npm run dev:server` | Hono API with reload on port 8787               |
| `npm run build`      | Typecheck, then build the frontend into `dist/` |
| `npm start`          | Serve API and built frontend on port 8787       |
| `npm test`           | Vitest single run                               |
| `npm run lint`       | ESLint plus a Prettier check                    |
| `npm run typecheck`  | `tsc --noEmit`                                  |
| `npm run format`     | Prettier write                                  |

## Architecture

- `src/server.ts` is the backend entry point: it builds the Hono app, mounts the `/api` routes, and
  serves the built frontend from `dist/` so a single process can host the whole app.
- `src/shared/types.ts` holds the TypeScript contracts (`GearItem`, `DashboardStats`, `Activity`,
  and the request payloads) that both the React frontend and the Hono backend import, so the API
  shape cannot drift between the two halves of the app.
- `index.html` is the Vite entry and loads `/src/main.tsx`. The React app consumes relative `/api`
  URLs only; Vite proxies those to the backend during development.
- Storage is an in-memory, boot-seeded store: the demo data is deterministic and intentionally
  resets whenever the process restarts. Nothing is written to disk and no credentials are needed.
- Tooling is a single flat ESLint config (typescript-eslint recommended, the classic React Hooks
  rules, React Refresh) plus Prettier, TypeScript strict mode, and Vitest. CI runs
  `npm ci`, lint, typecheck, tests, build, and a live health check against the started server.

### Testing notes

Vitest runs in a Node environment by default, which is what the API tests need. Component tests can
opt into a DOM by adding a `// @vitest-environment jsdom` comment at the top of the test file;
jsdom and Testing Library are already installed.

## License

[MIT](./LICENSE)
