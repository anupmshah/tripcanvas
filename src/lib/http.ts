import { NextResponse } from "next/server";
import { ZodError, ZodType } from "zod";

export const json = (data: unknown, status = 200) => NextResponse.json(data, { status });
export const err = (status: number, error: string, extra?: object) => NextResponse.json({ error, ...extra }, { status });

/** Parse a JSON body with Zod. Returns [data] or [null, 400-response]. */
export async function body<T>(req: Request, schema: ZodType<T>): Promise<[T, null] | [null, NextResponse]> {
  let raw: unknown;
  try { raw = await req.json(); } catch { return [null, err(400, "Body must be JSON")]; }
  try { return [schema.parse(raw), null]; } catch (e) {
    const msg = e instanceof ZodError ? e.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") : "Invalid body";
    return [null, err(400, msg)];
  }
}
