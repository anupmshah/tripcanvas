export const addDays = (d: string, n: number) => {
  const x = new Date(d + "T00:00:00Z");
  x.setUTCDate(x.getUTCDate() + n);
  return x.toISOString().slice(0, 10);
};
export const diffDays = (a: string, b: string) =>
  Math.round((Date.parse(b) - Date.parse(a)) / 864e5);
export const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s));
export const today = () => new Date().toISOString().slice(0, 10);
export const fmtDay = (d: string) =>
  new Date(d + "T00:00:00Z").toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
