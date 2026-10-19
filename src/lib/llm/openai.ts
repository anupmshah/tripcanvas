import "server-only";
import OpenAI from "openai";
import { ZodType } from "zod";
import { env } from "../env";

export class LlmInvalidOutput extends Error {}
export class LlmUnavailable extends Error {}
export type ChatMsg = { role: "system" | "user" | "assistant"; content: string };

let client: OpenAI | null = null;
/** Calls the model in JSON mode, validates with Zod, and retries with the validation errors fed back. */
export async function callJson<T>(schema: ZodType<T>, messages: ChatMsg[], opts: { maxAttempts?: number } = {}): Promise<T> {
  if (!env.OPENAI_API_KEY) throw new LlmUnavailable("OPENAI_API_KEY is not set");
  client ??= new OpenAI({ apiKey: env.OPENAI_API_KEY, timeout: 90_000, maxRetries: 1 });
  const msgs = [...messages];
  let lastProblem = "";
  for (let attempt = 1; attempt <= (opts.maxAttempts ?? 3); attempt++) {
    let text = "";
    try {
      const r = await client.chat.completions.create({ model: env.OPENAI_MODEL, response_format: { type: "json_object" }, messages: msgs });
      text = r.choices[0]?.message?.content ?? "";
    } catch (e) {
      throw new LlmUnavailable(`OpenAI request failed: ${(e as Error).message.slice(0, 200)}`);
    }
    try {
      const parsed = schema.safeParse(JSON.parse(text));
      if (parsed.success) return parsed.data;
      lastProblem = parsed.error.issues.slice(0, 8).map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`).join("; ");
    } catch {
      lastProblem = "the output was not valid JSON";
    }
    msgs.push({ role: "assistant", content: text.slice(0, 6000) }, { role: "user", content: `Your JSON was invalid. Fix these issues and return the complete corrected JSON only: ${lastProblem}` });
  }
  throw new LlmInvalidOutput(`Model output stayed invalid after retries: ${lastProblem}`);
}
