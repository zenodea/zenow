# Zenow

Save a link, get the substance back. A Firefox button posts the current tab to
an API, a worker fetches and summarises it, and a web UI shows the result.

Single user by design.

```
Firefox ext ──POST /api/items──▶ Vercel (Next.js)
                                    │ insert item + job, one transaction
                                    ▼
                                 Neon Postgres ◀── poll (SKIP LOCKED) ── Fly.io worker
                                    ▲                                        │
                                    └── contents + summaries ◀───────────────┘
```

The database is also the queue. That means enqueueing a job is part of the same
transaction that inserts the item, so an item can never exist with no work
scheduled for it, and `SELECT … FOR UPDATE SKIP LOCKED` keeps it correct if a
second worker is ever added.

## Layout

| Path | What it is |
|---|---|
| `apps/web` | Next.js UI and API routes. Deploys to Vercel. |
| `apps/worker` | Queue loop, fetch and summarise. Deploys to Fly. |
| `apps/extension` | Firefox MV3 extension. No build step. |
| `packages/shared` | URL canonicalisation and the API contract (zod). |
| `packages/db` | Drizzle schema, migrations, typed client. |
| `packages/adapters` | article / reddit / youtube extraction. No database access. |

`packages/adapters` never touches the database on purpose: extraction can be
tested against saved HTML and run from a script without standing anything up.

## Running it locally

```bash
pnpm install
pnpm --filter "./packages/*" build

# apps/web/.env.local
DATABASE_URL=…                 # Neon pooled url
SESSION_SECRET=…               # 32+ random characters
LOGIN_PASSPHRASE_HASH=$(pnpm --filter @zenow/web passphrase)

# apps/worker/.env
DATABASE_URL_UNPOOLED=…        # Neon direct url
OPENROUTER_API_KEY=…
LLM_MODEL=anthropic/claude-haiku-4.5

pnpm --filter @zenow/db migrate
pnpm dev:web       # http://localhost:3007
pnpm dev:worker
```

Pooled and direct URLs are used deliberately: the web app goes through
PgBouncer (so prepared statements are off), the worker connects directly
because its claim query wants them.

Mint a token for the extension or a `curl`:

```bash
pnpm --filter @zenow/web token firefox
```

## Choosing a model

`LLM_MODEL` is any OpenRouter slug, so comparing costs nothing but a restart:

| Slug | Input / output per Mtok | Notes |
|---|---|---|
| `anthropic/claude-haiku-4.5` | $1.00 / $5.00 | default; best summaries of the cheap tier |
| `google/gemini-2.5-flash-lite` | $0.10 / $0.40 | 10x cheaper, 1M context |
| `openai/gpt-5-mini` | $0.25 / $2.00 | middle ground |

`tokens_in` / `tokens_out` are stored per item, so the real cost per source
type is a query away rather than a guess.

## Deploying

**Vercel** — import the repo, root directory `apps/web`. Set `DATABASE_URL`,
`SESSION_SECRET`, `LOGIN_PASSPHRASE_HASH`, `WORKER_URL`, `WORKER_SECRET`.

**Fly** — the Docker build context is the repo root, not `apps/worker`:

```bash
fly launch --no-deploy --config apps/worker/fly.toml
fly secrets set DATABASE_URL_UNPOOLED=… OPENROUTER_API_KEY=… WORKER_SECRET=… \
                REDDIT_CLIENT_ID=… REDDIT_CLIENT_SECRET=…
fly deploy --config apps/worker/fly.toml --dockerfile apps/worker/Dockerfile
```

`min_machines_running = 1` is deliberate. Fly's proxy only sees HTTP traffic,
so it would stop an idle machine that is actually mid-job.

## Things that will break, and what happens

| Problem | What the system does |
|---|---|
| Site returns 403 / Cloudflare | `blocked`, backs off exponentially, retries |
| Page renders client-side | `needs_browser`, fails once without retrying, reason shown on the item |
| Reddit without credentials | fails with the exact env vars to set |
| yt-dlp breaks after a YouTube change | adapter tests against fixtures catch it; rebuild pulls latest |
| Worker killed mid-job | stale-lock sweep releases the row after 10 minutes |
| Model returns malformed JSON | one correction round with the validation errors, then fails visibly |
| Same link saved twice | `canonical_url` unique constraint; the API returns the existing item |

## Tests

```bash
pnpm test
```

Extraction is tested against real saved pages in `packages/adapters/fixtures`,
refreshable with `pnpm --filter @zenow/adapters fixtures:refresh`. That is
what catches a Readability or yt-dlp upgrade quietly changing the output.
