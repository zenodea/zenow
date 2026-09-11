const MACHINES_API = "https://api.machines.dev/v1";

/**
 * Fly tokens are ~600 characters and are usually copied out of a terminal,
 * which happily wraps them across lines. Trimming the ends is not enough --
 * a newline in the middle produces a token that looks right and fails with
 * "token validation error". Fly accepts the value with or without the
 * "FlyV1 " prefix, so only whitespace has to go.
 */
export function normalizeFlyToken(raw: string): string {
  return raw.replace(/\s+/g, " ").replace(/^FlyV1\s+/i, "FlyV1 ").trim();
}

export function looksLikeFlyToken(raw: string): boolean {
  return /fm2_[A-Za-z0-9+/=_-]{20,}/.test(normalizeFlyToken(raw));
}

/**
 * Verifies a token against the one app it is meant to manage.
 *
 * This deliberately does not use an org-level endpoint. An app-scoped deploy
 * token -- the kind worth asking anyone to hand over -- is not permitted to
 * list an organization's apps and gets a 403 there, so checking that way
 * rejected exactly the tokens it should have accepted.
 */
export async function verifyToken(
  token: string,
  appName: string,
  orgSlug = "personal",
): Promise<{ ok: true; created: boolean } | { ok: false; reason: string }> {
  let response: Response;
  try {
    response = await fetch(`${MACHINES_API}/apps/${encodeURIComponent(appName)}/machines`, {
      headers: { authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    return { ok: false, reason: "Could not reach Fly to check the token." };
  }

  if (response.ok) return { ok: true, created: false };

  if (response.status === 404) {
    // The app does not exist. Make it, if this token is allowed to.
    const outcome = await createApp(token, appName, orgSlug).catch(() => "forbidden" as const);
    if (outcome === "created") return { ok: true, created: true };
    return {
      ok: false,
      reason:
        `Fly has no app called "${appName}", and this token cannot create one — app-scoped deploy ` +
        `tokens can only manage an app that already exists. Either create it yourself with ` +
        `"fly apps create ${appName}", or paste an org-scoped token and Zenow will create it for you.`,
    };
  }

  const reason =
    response.status === 401
      ? "Fly rejected that token. Re-copy it whole and check it has not been revoked."
      : response.status === 403
        ? `That token is not allowed to manage "${appName}". Create it for this app: fly tokens create deploy -a ${appName}`
        : `Fly returned ${response.status} when checking the token.`;

  return { ok: false, reason };
}

export class FlyError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "FlyError";
    this.status = status;
  }
}

type MachineConfig = {
  image: string;
  env: Record<string, string>;
  guest: { cpu_kind: string; cpus: number; memory_mb: number };
  services: unknown[];
  restart: { policy: string };
};

export type Machine = { id: string; name: string; state: string; region?: string };

async function call<T>(token: string, path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${MACHINES_API}${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      ...init.headers,
    },
    signal: AbortSignal.timeout(30_000),
  });

  const text = await response.text();
  if (!response.ok) {
    // Fly returns json errors, but not always; the body is more use than the code.
    const detail =
      response.status === 401
        ? "Fly rejected your token. Re-copy it whole (they wrap across lines in a terminal) and check it has not been revoked."
        : `Fly returned ${response.status}: ${text.slice(0, 300)}`;
    throw new FlyError(response.status, detail);
  }
  return (text ? JSON.parse(text) : {}) as T;
}

/**
 * Creating an app needs organization-level permission. An app-scoped deploy
 * token cannot do it -- it is scoped to an app that must already exist -- so
 * this is attempted and allowed to fail, rather than required.
 */
export async function createApp(token: string, app: string, orgSlug: string): Promise<"created" | "forbidden"> {
  try {
    await call(token, "/apps", {
      method: "POST",
      body: JSON.stringify({ app_name: app, org_slug: orgSlug }),
    });
    return "created";
  } catch (error) {
    if (error instanceof FlyError && (error.status === 403 || error.status === 401)) return "forbidden";
    throw error;
  }
}

export function listMachines(token: string, app: string): Promise<Machine[]> {
  return call<Machine[]>(token, `/apps/${encodeURIComponent(app)}/machines`);
}

export function destroyMachine(token: string, app: string, machineId: string): Promise<unknown> {
  return call(token, `/apps/${encodeURIComponent(app)}/machines/${machineId}?force=true`, {
    method: "DELETE",
  });
}

export function createMachine(
  token: string,
  app: string,
  options: { name: string; region: string; image: string; env: Record<string, string>; memoryMb: number },
): Promise<Machine> {
  const config: MachineConfig = {
    image: options.image,
    env: options.env,
    guest: { cpu_kind: "shared", cpus: 1, memory_mb: options.memoryMb },
    // The worker serves /health and /kick; exposing it lets Fly health-check
    // the machine and lets the api wake it the moment something is saved.
    //
    // autostart is what makes a stopped machine come back: the proxy boots it
    // on the next request rather than refusing one. autostop stays off because
    // the proxy only counts http traffic, and this machine's work is a queue --
    // it would be stopped mid-job. The worker decides when it is idle.
    services: [
      {
        protocol: "tcp",
        internal_port: 8080,
        autostart: true,
        autostop: "off",
        ports: [
          { port: 80, handlers: ["http"] },
          { port: 443, handlers: ["tls", "http"] },
        ],
      },
    ],
    // Not "always": the worker stops itself by exiting zero when it has been
    // idle, and "always" would restart it straight back into an empty queue.
    restart: { policy: "on-failure" },
  };

  return call<Machine>(token, `/apps/${encodeURIComponent(app)}/machines`, {
    method: "POST",
    body: JSON.stringify({ name: options.name, region: options.region, config }),
  });
}

export function waitForStarted(token: string, app: string, machineId: string, timeout = 60): Promise<unknown> {
  return call(
    token,
    `/apps/${encodeURIComponent(app)}/machines/${machineId}/wait?state=started&timeout=${timeout}`,
  );
}
