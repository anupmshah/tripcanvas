import { applyPatch } from "@/lib/patch/apply";
import { err, json } from "@/lib/http";
export const runtime = "nodejs";
export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const result = await applyPatch((await params).id);
    return result ? json(result) : err(409, "Patch no longer pending");
  } catch (e) {
    if ((e as { code?: string }).code === "P2034")
      return err(409, "Trip changed while applying. Please retry.");
    throw e;
  }
}
