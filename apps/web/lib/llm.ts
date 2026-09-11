import { z } from "zod";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

export class LlmError extends Error {
  readonly retryable: boolean;

  constructor(message: string, retryable: boolean, options: { cause?: unknown } = {}) {
    super(message, options);
    this.name = "LlmError";
    this.retryable = retryable;
  }
}

/**
 * One structured call to the tenant's own OpenRouter account. The worker uses
 * the openai sdk for this; here it is a fetch, because a request the runtime
 * already knows how to make is not worth a dependency.
 */
export async function completeJson<T>(
  credentials: { key: string; model: string },
  input: { system: string; user: string; schema: z.ZodType<T>; name: string; maxTokens?: number },
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        authorization: `Bearer ${credentials.key}`,
        "content-type": "application/json",
        "X-Title": "Zenow",
      },
      body: JSON.stringify({
        model: credentials.model,
        max_tokens: input.maxTokens ?? 8000,
        messages: [
          { role: "system", content: input.system },
          { role: "user", content: input.user },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: input.name,
            strict: true,
            schema: z.toJSONSchema(input.schema) as Record<string, unknown>,
          },
        },
      }),
    });
  } catch (cause) {
    throw new LlmError("Could not reach OpenRouter", true, { cause });
  }

  if (response.status === 401) throw new LlmError("Your OpenRouter key was rejected", false);
  if (response.status === 402) throw new LlmError("Your OpenRouter account is out of credit", false);
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new LlmError(`${credentials.model} returned ${response.status}: ${detail.slice(0, 300)}`, response.status >= 500 || response.status === 429);
  }

  const body = (await response.json().catch(() => null)) as {
    choices?: { message?: { content?: string } }[];
  } | null;

  const content = body?.choices?.[0]?.message?.content?.trim();
  if (!content) throw new LlmError(`${credentials.model} returned nothing`, true);

  // Models that ignore response_format still like to wrap JSON in a fence.
  const unfenced = content.replace(/^\s*```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "");

  let parsed: unknown;
  try {
    parsed = JSON.parse(unfenced);
  } catch (cause) {
    throw new LlmError(`${credentials.model} did not return JSON`, true, { cause });
  }

  const result = input.schema.safeParse(parsed);
  if (!result.success) {
    throw new LlmError(`${credentials.model} returned the wrong shape: ${result.error.message.slice(0, 200)}`, true);
  }
  return result.data;
}
