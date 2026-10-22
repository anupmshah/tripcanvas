import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getTripDTO } from "@/lib/dto";
import ReadOnlyItinerary from "@/components/trip/ReadOnlyItinerary";
export const dynamic = "force-dynamic";
export default async function SharePage({ params }: { params: Promise<{ token: string }> }) {
  const share = await prisma.shareLink.findUnique({ where: { token: (await params).token } });
  if (!share) notFound();
  const dto = await getTripDTO(share.tripId);
  if (!dto) notFound();
  const shared = {
    ...dto,
    days: dto.days.map((d) => ({ ...d, items: d.items.map((i) => ({ ...i, bookingRef: null })) })),
  };
  return <ReadOnlyItinerary dto={shared} />;
}
