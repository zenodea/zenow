import { summaryResultSchema, type ImageRef, type SourceType, type SummaryResult } from "@zenow/shared";
import OpenAI from "openai";
import { z } from "zod";
import { CHUNK_CHARS, SINGLE_PASS_CHARS, splitIntoChunks } from "./chunk.js";
import { SYSTEM_PROMPT, buildUserMessage } from "./prompt.js";

export { splitIntoChunks } from "./chunk.js";

const OUTPUT_SCHEMA = z.toJSONSchema(summaryResultSchema) as Record<string, unknown>;

export class SummarizerError extends Error {
  readonly retryable: boolean;

  constructor(message: string, retryable: boolean, options: { cause?: unknown } = {}) {
    super(message, options);
    this.name = "SummarizerError";
    this.retryable = retryable;
  }
}

export type SummarizeInput = {
  sourceType: SourceType;
  title: string | null;
  url: string;
  text: string;
  images: ImageRef[];
  meta: Record<string, unknown>;
  /** Vocabulary already in use, so the model reuses rather than reinvents. */
  knownTags: { tag: string; uses: number }[];
};

export type SummarizeResult = SummaryResult & {
  model: string;
  tokensIn: number;
  tokensOut: number;
};

/** Whose OpenRouter account this summary is billed to. */
export type LlmCredentials = { apiKey: string; model: string };

type Usage = { tokensIn: number; tokensOut: number };

/** One client per key, so a shared worker does not rebuild them per job. */
const clients = new Map<string, OpenAI>();

function openrouter(apiKey: string): OpenAI {
  let client = clients.get(apiKey);
  if (!client) {
    client = new OpenAI({
      apiKey,
      baseURL: "https://openrouter.ai/api/v1",
      defaultHeaders: { "X-Title": "Zenow" },
    });
    clients.set(apiKey, client);
  }
  return client;
}

/** 429 and 5xx are worth another go; a bad request or a bad key never is. */
function classify(error: unknown, model: string): SummarizerError {
  if (error instanceof OpenAI.APIError) {
    const status = error.status ?? 0;
    // 401/402 mean the tenant's own key is wrong or out of credit: retrying
    // will not fix either, and the message has to say which.
    if (status === 401) return new SummarizerError("Your OpenRouter key was rejected", false, { cause: error });
    if (status === 402) return new SummarizerError("Your OpenRouter account is out of credit", false, { cause: error });
    const retryable = status === 429 || status >= 500;
    return new SummarizerError(`${model} returned ${status}: ${error.message}`, retryable, { cause: error });
  }
  if (error instanceof OpenAI.APIConnectionError) {
    return new SummarizerError("Could not reach OpenRouter", true, { cause: error });
  }
  return new SummarizerError(error instanceof Error ? error.message : String(error), false, { cause: error });
}

async function complete(
  credentials: LlmCredentials,
  messages: OpenAI.Chat.ChatCompletionMessageParam[],
  usage: Usage,
  jsonSchema?: Record<string, unknown>,
): Promise<string> {
  let response: OpenAI.Chat.ChatCompletion;
  try {
    response = await openrouter(credentials.apiKey).chat.completions.create({
      model: credentials.model,
      max_tokens: 4000,
      messages,
      ...(jsonSchema
        ? {
            response_format: {
              type: "json_schema",
              json_schema: { name: "summary", strict: true, schema: jsonSchema },
            },
          }
        : {}),
    });
  } catch (error) {
    throw classify(error, credentials.model);
  }

  usage.tokensIn += response.usage?.prompt_tokens ?? 0;
  usage.tokensOut += response.usage?.completion_tokens ?? 0;

  const content = response.choices[0]?.message?.content?.trim();
  if (!content) throw new SummarizerError(`${credentials.model} returned an empty response`, true);
  return content;
}

/** Models that ignore response_format still like to wrap JSON in a fence. */
function parseJson(raw: string): unknown {
  const unfenced = raw
    .replace(/^\s*```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/, "")
    .trim();
  try {
    return JSON.parse(unfenced);
  } catch (cause) {
    throw new SummarizerError("Model did not return JSON", true, { cause });
  }
}

/** Long transcripts: summarize each section, then summarize the summaries. */
async function condense(credentials: LlmCredentials, text: string, usage: Usage): Promise<string> {
  const chunks = splitIntoChunks(text, CHUNK_CHARS);
  const parts: string[] = [];

  for (const [index, chunk] of chunks.entries()) {
    const part = await complete(
      credentials,
      [
        {
          role: "system",
          content:
            "Summarize this section of a longer document in under 200 words. Keep concrete facts, numbers, names and claims. Plain prose, no preamble.",
        },
        { role: "user", content: `Section ${index + 1} of ${chunks.length}:\n\n${chunk}` },
      ],
      usage,
    );
    parts.push(`Section ${index + 1}: ${part}`);
  }

  return parts.join("\n\n");
}

export async function summarize(input: SummarizeInput, credentials: LlmCredentials): Promise<SummarizeResult> {
  const usage: Usage = { tokensIn: 0, tokensOut: 0 };

  const text =
    input.text.length > SINGLE_PASS_CHARS ? await condense(credentials, input.text, usage) : input.text;

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: buildUserMessage({ ...input, text }) },
  ];

  let raw = await complete(credentials, messages, usage, OUTPUT_SCHEMA);
  let parsed = summaryResultSchema.safeParse(parseJson(raw));

  // One correction round for a model that honoured the shape loosely.
  if (!parsed.success) {
    messages.push({ role: "assistant", content: raw });
    messages.push({
      role: "user",
      content: `That did not validate: ${parsed.error.issues
        .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
        .join("; ")}. Return corrected JSON only.`,
    });
    raw = await complete(credentials, messages, usage, OUTPUT_SCHEMA);
    parsed = summaryResultSchema.safeParse(parseJson(raw));
  }

  if (!parsed.success) {
    throw new SummarizerError(`${credentials.model} could not produce a valid summary`, false, {
      cause: parsed.error,
    });
  }

  return { ...parsed.data, model: credentials.model, ...usage };
}
