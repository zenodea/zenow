import { z } from "zod";
import { imagePickSchema, imageRefSchema } from "./api.js";
import { sourceTypes } from "./url.js";

/**
 * The protocol between the api and a worker running on a tenant's own
 * infrastructure. It exists so that worker never holds a database credential:
 * it is handed exactly the work it needs and posts back exactly the result.
 */

export const workerItemSchema = z.object({
  id: z.uuid(),
  url: z.string(),
  title: z.string().nullable(),
  source_type: z.enum(sourceTypes),
});

export const workerFetchJobSchema = z.object({
  kind: z.literal("fetch"),
  job_id: z.number(),
  item: workerItemSchema,
});

export const workerSummarizeJobSchema = z.object({
  kind: z.literal("summarize"),
  job_id: z.number(),
  item: workerItemSchema,
  content: z.object({
    text: z.string(),
    images: z.array(imageRefSchema),
    meta: z.record(z.string(), z.unknown()),
  }),
  known_tags: z.array(z.object({ tag: z.string(), uses: z.number() })),
});

export const workerJobSchema = z.discriminatedUnion("kind", [
  workerFetchJobSchema,
  workerSummarizeJobSchema,
]);
export type WorkerJob = z.infer<typeof workerJobSchema>;

export const workerClaimResponseSchema = z.object({ job: workerJobSchema.nullable() });

export const workerFetchResultSchema = z.object({
  job_id: z.number(),
  title: z.string(),
  text: z.string(),
  html: z.string().nullable(),
  images: z.array(imageRefSchema),
  meta: z.record(z.string(), z.unknown()),
});
export type WorkerFetchResult = z.infer<typeof workerFetchResultSchema>;

export const workerSummarizeResultSchema = z.object({
  job_id: z.number(),
  model: z.string(),
  title: z.string(),
  summary_md: z.string(),
  key_points: z.array(z.string()),
  image_picks: z.array(imagePickSchema),
  read_time_min: z.number().int().nonnegative(),
  tags: z.array(z.string()),
  tokens_in: z.number().int().nonnegative(),
  tokens_out: z.number().int().nonnegative(),
});
export type WorkerSummarizeResult = z.infer<typeof workerSummarizeResultSchema>;

export const workerFailureSchema = z.object({
  job_id: z.number(),
  message: z.string().max(2000),
  retryable: z.boolean(),
});
export type WorkerFailure = z.infer<typeof workerFailureSchema>;
