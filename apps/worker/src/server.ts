import { timingSafeEqual } from "node:crypto";
import { createServer, type Server } from "node:http";
import { env } from "./env.js";
import { log } from "./logger.js";

function secretMatches(provided: string | string[] | undefined): boolean {
  if (!env.workerSecret) return true;
  if (typeof provided !== "string") return false;

  const expected = Buffer.from(env.workerSecret);
  const actual = Buffer.from(provided);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/** /kick only wakes the loop; the work itself never happens on the request. */
export function startServer(onKick: () => void): Server {
  const server = createServer((request, response) => {
    if (request.method === "GET" && request.url === "/health") {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ ok: true }));
      return;
    }

    if (request.method === "POST" && request.url === "/kick") {
      if (!secretMatches(request.headers["x-worker-secret"])) {
        response.writeHead(401).end();
        return;
      }
      onKick();
      response.writeHead(202).end();
      return;
    }

    response.writeHead(404).end();
  });

  server.listen(env.port, () => log.info("listening", { port: env.port }));
  return server;
}
