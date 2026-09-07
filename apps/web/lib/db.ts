import { createDb, type Database } from "@zenow/db";
import { env } from "./env";

let instance: Database | undefined;

/** One pool per warm lambda; the pooled Neon url keeps that to one socket. */
export function db(): Database {
  instance ??= createDb(env.databaseUrl).db;
  return instance;
}
