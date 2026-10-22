import { notFound } from "next/navigation";
import { getTripDTO } from "@/lib/dto";
import TripWorkspace from "@/components/trip/TripWorkspace";

export const dynamic = "force-dynamic";
export default async function TripPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ initial?: string }>;
}) {
  const dto = await getTripDTO((await params).id);
  if (!dto) notFound();
  return (
    <TripWorkspace
      initial={dto}
      initialWarning={
        (await searchParams).initial === "failed"
          ? "Your trip is saved, but the first itinerary could not finish. Use chat to generate it again."
          : ""
      }
    />
  );
}
