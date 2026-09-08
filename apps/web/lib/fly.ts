const MACHINES_API = "https://api.machines.dev/v1";

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
    throw new FlyError(response.status, `Fly returned ${response.status}: ${text.slice(0, 300)}`);
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
