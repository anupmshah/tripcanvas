import { addDays } from "../dates";
type CalendarTrip = { trip: { title: string }; stops: { id: string; city: string }[]; days: { date: string; stopId: string; items: { id: string; title: string; start: string | null; end: string | null; notes: string | null }[] }[] };
const escape = (s: string) => s.replaceAll("\\", "\\\\").replace(/\r\n|\r|\n/g, "\\n").replaceAll(";", "\\;").replaceAll(",", "\\,");
function fold(s: string) {
  let out = "", count = 0;
  for (const ch of s) {
    const bytes = Buffer.byteLength(ch, "utf8");
    if (count + bytes > 75) { out += "\r\n "; count = 1; }
    out += ch; count += bytes;
  }
  return out;
}
export function makeIcs(dto: CalendarTrip) {
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//TripCanvas//Itinerary//EN", "CALSCALE:GREGORIAN", `X-WR-CALNAME:${escape(dto.trip.title)}`];
  const compact = (d: string) => d.replaceAll("-", "");
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  for (const d of dto.days) for (const item of d.items) {
    lines.push("BEGIN:VEVENT", `UID:${item.id}@tripcanvas.local`, `DTSTAMP:${stamp}`, `SUMMARY:${escape(item.title)}`);
    if (item.start) {
      lines.push(`DTSTART:${compact(d.date)}T${item.start.replace(":", "")}00`);
      if (item.end) lines.push(`DTEND:${compact(item.end < item.start ? addDays(d.date, 1) : d.date)}T${item.end.replace(":", "")}00`);
    } else lines.push(`DTSTART;VALUE=DATE:${compact(d.date)}`, `DTEND;VALUE=DATE:${compact(addDays(d.date, 1))}`);
    const city = dto.stops.find((s) => s.id === d.stopId)?.city;
    if (city) lines.push(`LOCATION:${escape(city)}`);
    if (item.notes) lines.push(`DESCRIPTION:${escape(item.notes)}`);
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}
