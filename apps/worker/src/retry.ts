import { AdapterError } from "@zenow/adapters";
import { SummarizerError } from "./summarize/index.js";

/** Unknown failures are treated as transient; max_attempts stops the bleeding. */
export function isRetryable(error: unknown): boolean {
  if (error instanceof AdapterError) return error.retryable;
  if (error instanceof SummarizerError) return error.retryable;
  return true;
}
