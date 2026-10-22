import { notFound } from "next/navigation";
import { getTripDTO } from "@/lib/dto";
import ReadOnlyItinerary from "@/components/trip/ReadOnlyItinerary";
import PrintAction from "@/components/trip/PrintAction";
export const dynamic = "force-dynamic";
export default async function PrintPage({ params }: { params: Promise<{ id: string }> }) {
  const dto = await getTripDTO((await params).id); if (!dto) notFound();
  return <><PrintAction /><ReadOnlyItinerary dto={dto} /></>;
}
