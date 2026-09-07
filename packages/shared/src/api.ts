import { z } from "zod";
import { sourceTypes } from "./url.js";

export const itemStatuses = ["queued", "fetching", "summarizing", "done", "failed"] as const;
export type ItemStatus = (typeof itemStatuses)[number];

export const jobKinds = ["fetch", "summarize"] as const;
export type JobKind = (typeof jobKinds)[number];

export const savedFromValues = ["extension", "web", "tui", "subscription"] as const;
export type SavedFrom = (typeof savedFromValues)[number];

export const imageRefSchema = z.object({
  index: z.number().int().nonnegative(),
  url: z.string(),
  alt: z.string().optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
});
export type ImageRef = z.infer<typeof imageRefSchema>;

export const imagePickSchema = z.object({
  index: z.number().int().nonnegative(),
  caption: z.string(),
});
export type ImagePick = z.infer<typeof imagePickSchema>;

/** Exactly what the summarizer must return. */
export const summaryResultSchema = z.object({
  title: z.string().min(1),
  summary_md: z.string().min(1),
  key_points: z.array(z.string().min(1)).min(1).max(8),
  image_picks: z.array(imagePickSchema).max(3),
  read_time_min: z.number().int().nonnegative(),
  tags: z.array(z.string().min(1)).min(1).max(3),
});
export type SummaryResult = z.infer<typeof summaryResultSchema>;

export const saveItemRequestSchema = z.object({
  url: z.string().trim().min(1).max(4096),
  saved_from: z.enum(savedFromValues).default("web"),
});
export type SaveItemRequest = z.input<typeof saveItemRequestSchema>;

export const listItemsQuerySchema = z.object({
  status: z.enum(itemStatuses).optional(),
  q: z.string().trim().min(1).max(200).optional(),
  tag: z.string().trim().min(1).max(64).optional(),
  cursor: z.string().optional(),
  ids: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});
export type ListItemsQuery = z.infer<typeof listItemsQuerySchema>;

export const itemCardSchema = z.object({
  id: z.uuid(),
  url: z.string(),
  canonical_url: z.string(),
  title: z.string().nullable(),
  source_type: z.enum(sourceTypes),
  status: z.enum(itemStatuses),
  error: z.string().nullable(),
  saved_from: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
  read_time_min: z.number().nullable(),
  lead: z.string().nullable(),
  thumbnail: z.string().nullable(),
  tags: z.array(z.string()),
});
export type ItemCard = z.infer<typeof itemCardSchema>;

export const pickedImageSchema = imageRefSchema.extend({ caption: z.string() });
export type PickedImage = z.infer<typeof pickedImageSchema>;

export const itemDetailSchema = itemCardSchema.extend({
  summary: z
    .object({
      model: z.string(),
      summary_md: z.string(),
      key_points: z.array(z.string()),
      images: z.array(pickedImageSchema),
      tokens_in: z.number().nullable(),
      tokens_out: z.number().nullable(),
      created_at: z.string(),
    })
    .nullable(),
  content: z
    .object({
      text: z.string(),
      html: z.string().nullable(),
      images: z.array(imageRefSchema),
      meta: z.record(z.string(), z.unknown()),
      fetched_at: z.string(),
    })
    .nullable(),
});
export type ItemDetail = z.infer<typeof itemDetailSchema>;

export const saveItemResponseSchema = z.object({
  id: z.uuid(),
  status: z.enum(itemStatuses),
  created: z.boolean(),
});
export type SaveItemResponse = z.infer<typeof saveItemResponseSchema>;

export const listItemsResponseSchema = z.object({
  items: z.array(itemCardSchema),
  next_cursor: z.string().nullable(),
});
export type ListItemsResponse = z.infer<typeof listItemsResponseSchema>;

export const errorResponseSchema = z.object({ error: z.string() });
