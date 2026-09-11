# Zenow

- Web: https://news.zenodea.com
- Worker: https://zenow-worker.fly.dev

Save a link, get the substance back. A Firefox button posts the current tab to
an API, a worker fetches and summarises it, and a web UI shows the result.
Articles, reddit threads, youtube transcripts and pdfs — a pdf is recognised
by what the server sends, not by the url, so a paper behind `/download?id=7`
still reads as a paper.

Multi-tenant. A user is a tenant: sign in and you have a feed, which nobody
else can see. Reading an item marks it read; archiving takes it out of the feed
without deleting it, and the archive is its own view.

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
instance. `tenant_id` is the signed-in user's id, so signing up is the whole of
onboarding — there is no workspace to create and nothing to pick.

Neon Auth's organization plugin is still enabled and its tables are still
there, unused. `tenant_id` is a uuid either way, so shared feeds could arrive
later by resolving the tenant to an organization id for users who have one,
with no migration.

`tenant_id` is `NOT NULL` on every table and denormalised onto `contents`,
`summaries` and `jobs` even though they hang off `items`, so a row-level policy
never needs a join to decide who owns a row. Dedup is per tenant: the same link
saved by two people is two items, not a conflict.

Every function in `apps/web/lib/items.ts` takes `tenantId` as its first
argument, and none of them accept `undefined`. Forgetting to scope a query is a
compile error rather than a cross-tenant read.

## Layout

| Path | What it is |
|---|---|
| `apps/web` | Next.js UI and API routes. Deploys to Vercel. |
| `apps/worker` | Queue loop, fetch and summarise. Deploys to Fly. |
| `apps/extension` | Firefox MV3 extension. No build step. |
| `apps/mobile` | Expo app for iOS and Android. Shares the contract, not the code. |
| `packages/shared` | URL canonicalisation and the API contract (zod). |
| `packages/db` | Drizzle schema, migrations, typed client. |
| `packages/adapters` | article / reddit / youtube / pdf extraction. No database access. |

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

Mint a token for the extension or a `curl` on `/settings` → *Extension
tokens*. It is shown once and stored as a sha256, so it is revoked and
replaced rather than looked up. The extension needs nothing else: it talks to
`news.zenodea.com` and no other host. The same thing from a shell, which needs
the tenant id the page already knows:

```bash
pnpm --filter @zenow/web token <tenant-id> firefox
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

## Clients

The api is the product boundary, not an afterthought behind the ui. Every
route goes through `authenticate()`, which takes a session cookie or a bearer
token, so the browser, the extension and the phone are three clients of one
contract rather than one client and two workarounds. `packages/shared` holds
that contract as zod schemas, and the mobile app imports it directly, so a
client cannot drift from the server without failing to compile.

## Installing it as an app

It is a PWA, which is the cheapest honest answer to "make this an app": no
store, no review, no second codebase, and the thing people install is the thing
that is already deployed. Chrome and Edge offer *Install*; iOS Safari does it
through *Share → Add to Home Screen*; Firefox Android through *Install*.

Installed, it registers a service worker that caches the build output and the
pages already visited, so a summary you have opened is readable with no
connection. `/api`, `/auth`, `/account` and `/share` are never cached, and a
response that redirected is not stored under the url that was asked for --
otherwise a sign-in redirect would be cached as though it were your list.

On Android the manifest registers a share target, so *Share → Zenow* saves a
link from any app. That is the extension's job done without an extension, and
it is why the phone does not need one.

## The weekly digest

Once a week the model is handed everything saved that week -- titles, tags and
the points each summary drew out -- and writes what the week was about. It is
told that some weeks are a pile rather than a theme, and that saying so is the
honest answer.

The digest is an item, with `zenow:digest/<iso-week>` for a url. That is the
whole design: the feed, search, tags, archiving, the reading view and Listen
all work on it with no special case, and the unique index on
`(tenant_id, canonical_url)` is what stops a second one being written for the
same week.

Unlike every other summary this one runs in the web app rather than the worker,
because the scheduler is already there and the material is a database query
rather than a page to fetch. `vercel.json` runs it daily and it writes last
week's digest for anyone missing one, so a failed Monday is picked up on
Tuesday. Set `CRON_SECRET` or the scheduled route refuses everyone.

## Listening

The reading view speaks the summary through the browser's own
`speechSynthesis`. That is a deliberate choice over a hosted voice: it costs
nothing per article, needs no audio storage, no signed urls and no new
credential, and it starts instantly because nothing is generated ahead of
time. The price is the voice, which is the operating system's.

Markdown is flattened before it is spoken and the text is queued as sentences
rather than one long utterance, because engines cut long utterances off
mid-word and a queue is what makes pausing land in a sensible place.

Swapping in a hosted voice later touches one component: generate audio on the
summarize job, store the file, and play it instead. The reason not to do that
yet is that it needs object storage, a per-article cost on every summary
whether or not anyone listens, and a cache to make the second play free.

## Choosing a model

`LLM_MODEL` is any OpenRouter slug, so comparing costs nothing but a restart:

| Slug | Input / output per Mtok | Notes |
|---|---|---|
| `openai/gpt-5.6-luna` | $0.20 / $1.20 | default; a fifth of Haiku 4.5 and newer, 1M context |
| `google/gemini-2.5-flash-lite` | $0.10 / $0.40 | cheapest that still holds the schema |
| `anthropic/claude-haiku-4.5` | $1.00 / $5.00 | the previous default |
| `anthropic/claude-sonnet-4.5` | $3.00 / $15.00 | when a summary is worth 15x |

`tokens_in` / `tokens_out` are stored per item, so the real cost per source
type is a query away rather than a guess.

## Deploying

**Vercel** — root directory `apps/web`. The web app's own build script builds
its workspace dependencies (`pnpm --filter @zenow/web^... build && next build`),
so no custom build command is needed. Vercel Authentication has to be off, or
the Fly worker cannot reach `/api/worker/*`. Set `DATABASE_URL`,
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
