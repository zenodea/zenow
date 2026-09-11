import {
  itemDetailSchema,
  listItemsResponseSchema,
  saveItemResponseSchema,
  type ItemCard,
  type ItemDetail,
  type ListItemsResponse,
} from "@zenow/shared";
import { z } from "zod";
import { API_URL, forgetToken, readToken } from "./auth";

export class Unauthorized extends Error {
  constructor() {
    super("This device is no longer connected");
    this.name = "Unauthorized";
  }
}

export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

const errorBody = z.object({ error: z.string() });

async function request<T>(path: string, schema: z.ZodType<T>, init: RequestInit = {}): Promise<T> {
  const token = await readToken();
  if (!token) throw new Unauthorized();

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: {
        authorization: `Bearer ${token}`,
        ...(init.body ? { "content-type": "application/json" } : {}),
        ...init.headers,
      },
    });
  } catch {
    throw new ApiError("No connection", 0);
  }

  if (response.status === 401) {
    // The token was revoked from the web app. Forgetting it here is what makes
    // the next screen offer to pair again rather than fail forever.
    await forgetToken();
    throw new Unauthorized();
  }

  if (response.status === 204) return schema.parse(undefined as never);

  const body: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const parsed = errorBody.safeParse(body);
    throw new ApiError(parsed.success ? parsed.data.error : `Zenow returned ${response.status}`, response.status);
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) throw new ApiError("Zenow sent something unexpected", response.status);
  return parsed.data;
}

async function send(path: string, init: RequestInit): Promise<void> {
  const token = await readToken();
  if (!token) throw new Unauthorized();

  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${token}`,
      ...(init.body ? { "content-type": "application/json" } : {}),
      ...init.headers,
    },
  });

  if (response.status === 401) {
    await forgetToken();
    throw new Unauthorized();
  }
  if (!response.ok) {
    const body: unknown = await response.json().catch(() => null);
    const parsed = errorBody.safeParse(body);
    throw new ApiError(parsed.success ? parsed.data.error : `Zenow returned ${response.status}`, response.status);
  }
}

export type Filter = { unread?: boolean; archived?: boolean; q?: string; tag?: string };

export function listItems(filter: Filter, cursor?: string | null): Promise<ListItemsResponse> {
  const params = new URLSearchParams({ limit: "25" });
  if (filter.unread) params.set("unread", "true");
  if (filter.archived) params.set("archived", "true");
  if (filter.q) params.set("q", filter.q);
  if (filter.tag) params.set("tag", filter.tag);
  if (cursor) params.set("cursor", cursor);

  return request(`/api/items?${params}`, listItemsResponseSchema);
}

export function listByIds(ids: string[]): Promise<ListItemsResponse> {
  return request(`/api/items?ids=${ids.join(",")}`, listItemsResponseSchema);
}

export function getItem(id: string): Promise<ItemDetail> {
  return request(`/api/items/${id}`, itemDetailSchema);
}

export function saveUrl(url: string): Promise<{ id: string; created: boolean }> {
  return request("/api/items", saveItemResponseSchema, {
    method: "POST",
    body: JSON.stringify({ url, saved_from: "extension" }),
  });
}

export const listTags = () =>
  request("/api/tags", z.object({ tags: z.array(z.object({ tag: z.string(), count: z.number() })) }));

export const whoAmI = () =>
  request("/api/me", z.object({ tenant_id: z.string(), connected_as: z.string() }));

export const markRead = (id: string) => send(`/api/items/${id}/read`, { method: "POST" });

export const setArchived = (id: string, archived: boolean) =>
  send(`/api/items/${id}/archive`, { method: "POST", body: JSON.stringify({ archived }) });

export const retryItem = (id: string) => send(`/api/items/${id}/retry`, { method: "POST" });

export const deleteItem = (id: string) => send(`/api/items/${id}`, { method: "DELETE" });

export const startResearch = (prompt: string) =>
  request("/api/research", saveItemResponseSchema, { method: "POST", body: JSON.stringify({ prompt }) });

export const weeklyDigest = () =>
  request("/api/digest", z.object({ id: z.string(), week: z.string() }), {
    method: "POST",
    body: JSON.stringify({ week: "this" }),
  });

export function isPending(item: ItemCard): boolean {
  return item.status !== "done" && item.status !== "failed";
}
