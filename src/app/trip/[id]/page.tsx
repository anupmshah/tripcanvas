import { notFound } from "next/navigation";
import { getTripDTO } from "@/lib/dto";

export const dynamic = "force-dynamic";
export default async function TripPage({ params }: { params: Promise<{ id: string }> }) {
  const dto = await getTripDTO((await params).id);
  if (!dto) notFound();
  return (
    <main className="space-y-4 p-6">
      <h1 className="text-2xl font-bold">{dto.trip.title}</h1>
      <p className="text-slate-600">{dto.trip.destination} · {dto.trip.startDate} → {dto.trip.endDate}</p>
      {dto.days.map((d) => (
        <section key={d.id}>
          <h2 className="font-semibold">Day {d.index + 1} · {d.date} · {dto.stops.find((s) => s.id === d.stopId)?.city}</h2>
          <ul className="ml-5 list-disc">{d.items.map((i) => <li key={i.id}>{i.title} <em>({i.status})</em></li>)}</ul>
        </section>
      ))}
    </main>
  );
}
