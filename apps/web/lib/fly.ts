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
): Promise<{ ok: true } | { ok: false; reason: string }> {
  let response: Response;
  try {
    response = await fetch(`${MACHINES_API}/apps/${encodeURIComponent(appName)}/machines`, {
      headers: { authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    return { ok: false, reason: "Could not reach Fly to check the token." };
  }

  if (response.ok) return { ok: true };

  const reason =
    response.status === 401
      ? "Fly rejected that token. Re-copy it whole and check it has not been revoked."
      : response.status === 403
        ? `That token is not allowed to manage "${appName}". Create it for this app: fly tokens create deploy -a ${appName}`
        : response.status === 404
          ? `Fly has no app called "${appName}". Create it first: fly apps create ${appName}`
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
    services: [
      {
        protocol: "tcp",
        internal_port: 8080,
        ports: [
          { port: 80, handlers: ["http"] },
          { port: 443, handlers: ["tls", "http"] },
        ],
      },
    ],
    restart: { policy: "always" },
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
