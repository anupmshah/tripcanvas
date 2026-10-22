import "server-only";
import OpenAI from "openai";
import { ZodType, type ZodError } from "zod";
import { env } from "../env";

export class LlmInvalidOutput extends Error {}
export class LlmUnavailable extends Error {}
type ChatMsg = { role: "system" | "user" | "assistant"; content: string };

let client: OpenAI | null = null;
export function jsonCorrections(error: ZodError) {
  return error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`).join("; ");
}
/** Calls the model in JSON mode, validates with Zod, and retries with the validation errors fed back. */
export async function callJson<T>(schema: ZodType<T>, messages: ChatMsg[]): Promise<T> {
  if (!env.OPENAI_API_KEY) throw new LlmUnavailable("OPENAI_API_KEY is not set");
  client ??= new OpenAI({ apiKey: env.OPENAI_API_KEY, timeout: 90_000, maxRetries: 1 });
  const msgs = [...messages];
  let lastProblem = "";
  for (let attempt = 1; attempt <= 3; attempt++) {
    let text = "";
    try {
      const r = await client.chat.completions.create({
        model: env.OPENAI_MODEL,
        response_format: { type: "json_object" },
        messages: msgs,
      });
      text = r.choices[0]?.message?.content ?? "";
    } catch (e) {
      throw new LlmUnavailable(`OpenAI request failed: ${(e as Error).message.slice(0, 200)}`);
    }
    try {
      const parsed = schema.safeParse(JSON.parse(text));
      if (parsed.success) return parsed.data;
      lastProblem = jsonCorrections(parsed.error);
    } catch {
      lastProblem = "the output was not valid JSON";
    }
    msgs.push(
      { role: "assistant", content: text },
      {
        role: "user",
        content: `Your JSON was invalid. Fix these issues and return the COMPLETE corrected JSON only. Preserve all planned days and operations and all original task requirements: ${lastProblem}`,
      },
    );
  }
  throw new LlmInvalidOutput(`Model output stayed invalid after retries: ${lastProblem}`);
}
