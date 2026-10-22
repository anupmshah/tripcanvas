import { body, err, json } from "@/lib/http";
import { rateLimit } from "@/lib/rateLimit";
import { env } from "@/lib/env";
import { FromTextInput, blockingQuestions } from "@/lib/llm/draft";
import { createFromDraft, proposeTrip } from "@/lib/llm/fromText";
import { LlmInvalidOutput, LlmUnavailable } from "@/lib/llm/openai";
export const runtime = "nodejs";
export async function POST(req: Request) {
  const limit = rateLimit(
    `start:${req.headers.get("x-forwarded-for") ?? "local"}`,
    env.CHAT_RATE_LIMIT_PER_MIN,
  );
  if (!limit.ok)
    return err(429, "Too many planning requests", { retryAfterSec: limit.retryAfterSec });
  const [d, bad] = await body(req, FromTextInput);
  if (bad) return bad;
  try {
    if (d.action === "create") {
      if (!d.draft || blockingQuestions(d.draft).length || !d.draft.route.length)
        return err(400, "Complete and review the route and dates first");
      return json(await createFromDraft(d.draft, d.text), 201);
    }
    const draft = await proposeTrip(d.text, d.draft, d.change);
    return json({
      draft,
      questions: blockingQuestions(draft),
      preferenceCandidates: draft.preferenceCandidates,
    });
  } catch (e) {
    if (e instanceof LlmInvalidOutput) return err(502, e.message);
    if (e instanceof LlmUnavailable) return err(503, "Planner unavailable. Please retry.");
    return err(
      422,
      (e as Error).message.startsWith("City not verified")
        ? (e as Error).message
        : "Could not create the trip. Please retry.",
    );
  }
}
