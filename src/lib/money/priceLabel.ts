export function priceLabel(source: string | null, fetchedAt: string | Date | null, now = new Date()) {
  const mayHaveChanged = source === "live" && (!fetchedAt || now.getTime() - new Date(fetchedAt).getTime() > 30 * 60_000);
  const tone = source === "live" ? (mayHaveChanged ? "stale" : "live") : source === "estimate" ? "estimate" : source === "entered" ? "entered" : "none";
  const text = tone === "none" ? "No price — check on provider" : tone === "stale" ? "Live · may have changed" : source === "live" ? "Live" : source === "estimate" ? "Estimate" : "Entered";
  return { text, tone, mayHaveChanged };
}
