"use client";
import { useState } from "react";
import type { ItemDTO } from "@/lib/dto";

const f = "w-full rounded border border-slate-300 px-2 py-1 text-sm";

export default function ItemEditor({
  item,
  defaultCurrency,
  onClose,
  onSaved,
}: {
  item: ItemDTO;
  defaultCurrency: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const booked = item.status === "booked";
  const nights = item.type === "stay" ? (item.stayNights ?? 1) : 1;
  const [title, setTitle] = useState(item.title);
  const [start, setStart] = useState(item.start ?? "");
  const [end, setEnd] = useState(item.end ?? "");
  const [notes, setNotes] = useState(item.notes ?? "");
  const [amount, setAmount] = useState(
    item.price == null ? "" : String(Number((item.price / nights).toFixed(3))),
  );
  const [priceEdited, setPriceEdited] = useState(false);
  const [ccy, setCcy] = useState(item.currency ?? defaultCurrency);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    const body: Record<string, unknown> = { notes: notes || null };
    if (!booked) {
      Object.assign(body, { title, start: start || null, end: end || null });
      if (priceEdited && amount !== "")
        body.entered = { amount: Number(amount) * nights, currency: ccy };
    }
    try {
      const r = await fetch(`/api/items/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error((await r.json()).error ?? "Save failed");
      onSaved();
      onClose();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[1100] grid place-items-center bg-black/30"
      role="dialog"
      aria-label="Edit item"
    >
      <form onSubmit={save} className="w-96 space-y-2 rounded-lg bg-white p-4 shadow-xl">
        <h2 className="font-semibold">
          Edit item{" "}
          {booked && (
            <span className="text-xs font-normal text-emerald-700">
              (booked — only notes editable)
            </span>
          )}
        </h2>
        <label className="block text-sm">
          Title
          <input
            className={f}
            disabled={booked}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
        </label>
        <div className="flex gap-2">
          <label className="block flex-1 text-sm">
            Start
            <input
              className={f}
              disabled={booked}
              type="time"
              value={start}
              onChange={(e) => setStart(e.target.value)}
            />
          </label>
          <label className="block flex-1 text-sm">
            End
            <input
              className={f}
              disabled={booked}
              type="time"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
            />
          </label>
        </div>
        <label className="block text-sm">
          Notes
          <textarea
            className={f}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
          />
        </label>
        {!booked && (
          <fieldset className="rounded border p-2">
            <legend className="px-1 text-xs text-slate-600">
              {item.type === "stay"
                ? `Nightly rate × ${nights} nights (saved as Entered total)`
                : "Price for the party (editing saves Entered)"}
            </legend>
            <div className="flex gap-2">
              <input
                className={f}
                type="number"
                min={0}
                step="0.001"
                placeholder={
                  item.type === "stay" ? "Nightly rate for the party" : "Total for the party"
                }
                value={amount}
                onChange={(e) => {
                  setAmount(e.target.value);
                  setPriceEdited(true);
                }}
              />
              <input
                className={`${f} w-20`}
                maxLength={3}
                value={ccy}
                onChange={(e) => {
                  setCcy(e.target.value.toUpperCase());
                  setPriceEdited(true);
                }}
              />
            </div>
          </fieldset>
        )}
        {err && (
          <p className="text-sm text-red-700" role="alert">
            {err}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-3 py-1 text-sm">
            Cancel
          </button>
          <button
            disabled={busy}
            className="rounded bg-sky-700 px-3 py-1 text-sm text-white disabled:opacity-50"
          >
            Save
          </button>
        </div>
      </form>
    </div>
  );
}
