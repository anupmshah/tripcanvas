import { notFound } from "next/navigation";
import { getTripDTO } from "@/lib/dto";
import TripWorkspace from "@/components/trip/TripWorkspace";

export const dynamic = "force-dynamic";
export default async function TripPage({ params }: { params: Promise<{ id: string }> }) {
  const dto = await getTripDTO((await params).id);
  if (!dto) notFound();
  return <TripWorkspace initial={dto} />;
}
