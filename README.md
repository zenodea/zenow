# Zenow

Save a link, get the substance back. A Firefox button posts the current tab to
an API, a worker fetches and summarises it, and a web UI shows the result.

Multi-tenant. A workspace is a Neon Auth organization, and every row carries
the organization id it belongs to.

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

## Tenancy

Auth is [Neon Auth](https://neon.com/docs/auth/overview), a managed Better Auth
instance that was already provisioned on the project. Its organization plugin
gives us tenants, roles and invitations without writing an auth system: an
organization *is* a workspace, and `session.activeOrganizationId` is the tenant
for the request.

`tenant_id` is `NOT NULL` on every table and denormalised onto `contents`,
`summaries` and `jobs` even though they hang off `items`, so a row-level policy
never needs a join to decide who owns a row. Dedup is per tenant: the same link
saved by two workspaces is two items, not a conflict.

Every function in `apps/web/lib/items.ts` takes `tenantId` as its first
argument, and none of them accept `undefined`. Forgetting to scope a query is a
compile error rather than a cross-tenant read.

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

# apps/web/.env.local  — `neon link` writes the first three
DATABASE_URL=…                 # Neon pooled url
NEON_AUTH_BASE_URL=…
NEON_AUTH_COOKIE_SECRET=…      # openssl rand -base64 32
CREDENTIALS_KEY=…              # openssl rand -base64 32

# apps/worker/.env  — the shared worker
DATABASE_URL_UNPOOLED=…        # Neon direct url
CREDENTIALS_KEY=…              # same value as above

pnpm --filter @zenow/db migrate
pnpm dev:web       # http://localhost:3007
pnpm dev:worker
```

Sign in, create a workspace, and add your OpenRouter key on `/settings`.
Anything saved before tenancy is claimed with:

```bash
pnpm --filter @zenow/web adopt <workspace-id>
```

Pooled and direct URLs are used deliberately: the web app goes through
PgBouncer (so prepared statements are off), the worker connects directly
because its claim query wants them.

Mint a token for the extension or a `curl`:

```bash
pnpm --filter @zenow/web token <workspace-id> firefox
```

## Two shapes of worker

The same binary runs either way, and the mode is decided by which variables
are present.

| | shared | per tenant |
|---|---|---|
| Set | `DATABASE_URL_UNPOOLED`, `CREDENTIALS_KEY` | `ZENOW_API_URL`, `ZENOW_WORKER_TOKEN`, `OPENROUTER_API_KEY` |
| Gets work | `SELECT … FOR UPDATE SKIP LOCKED` | `POST /api/worker/claim` |
| Holds | a database credential, and every tenant's encrypted keys | one worker token and one OpenRouter key |
| Runs on | your Fly account | the tenant's own Fly account |

The second shape is why the job api exists. A worker on somebody else's
infrastructure is handed exactly the job it is to do and posts the result
back; it never holds a database credential, so a machine that leaks exposes
one workspace rather than all of them. Every write checks the job belongs to
the calling tenant — a job id is not permission to touch it.

Provisioning creates that machine through the Fly Machines API using a token
the tenant pastes into `/settings`. It has to be an **app-scoped deploy
token** (`fly tokens create deploy -a <app>`), which can manage machines
inside one app and cannot create apps or touch the rest of the account. That
is also why the tenant creates the app themselves first.

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
`NEON_AUTH_BASE_URL`, `NEON_AUTH_COOKIE_SECRET`, `CREDENTIALS_KEY`,
`PUBLIC_APP_URL`, `WORKER_IMAGE` and optionally `WORKER_URL` / `WORKER_SECRET`.

`WORKER_IMAGE` must be a publicly pullable build of `apps/worker` — tenants'
Fly accounts pull it directly. `CREDENTIALS_KEY` decrypts every tenant's
stored keys, so losing it means they all have to be entered again, and
leaking it means they are all exposed.

Add each deployed origin as a Neon Auth redirect domain:

```bash
neon neon-auth domain add https://zenow.vercel.app
```

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
| Tenant's OpenRouter key rejected or out of credit | fails once without retrying, and says which |
| Fly app does not exist | provisioning explains that a deploy token cannot create apps |
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
