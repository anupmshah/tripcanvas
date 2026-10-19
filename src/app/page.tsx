import Link from "next/link";
import { prisma } from "@/lib/db";
import DemoButton from "@/components/DemoButton";
import NewTripForm from "@/components/NewTripForm";
import FreeTextStart from "@/components/FreeTextStart";

export const dynamic = "force-dynamic";
export default async function Home() {
  const [trips, profile] = await Promise.all([
    prisma.trip.findMany({ orderBy: { createdAt: "desc" }, take: 30 }),
    prisma.profile.upsert({ where: { id: "default" }, create: { id: "default" }, update: {} }),
  ]);
  return (
    <main className="mx-auto max-w-4xl space-y-6 p-6">
      <FreeTextStart />
      <details><summary className="cursor-pointer text-sm text-sky-700">Enter details manually</summary><NewTripForm homeAirport={profile.homeAirport} /></details>
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold">Your trips</h1>
        {process.env.NODE_ENV !== "production" && <DemoButton />}
      </div>
      <ul className="divide-y rounded-lg border bg-white">
        {trips.length === 0 && <li className="p-3 text-sm text-slate-500">No trips yet — create one below or open the demo.</li>}
        {trips.map((t) => (
          <li key={t.id} className="p-3">
            <Link href={`/trip/${t.id}`} className="font-medium text-sky-700 hover:underline">{t.title}</Link>
            <span className="ml-2 text-sm text-slate-500">{t.destination} · {t.startDate} → {t.endDate}</span>
          </li>
        ))}
      </ul>
    </main>
  );
}
