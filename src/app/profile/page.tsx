import { prisma } from "@/lib/db";
import ProfileForm from "@/components/ProfileForm";

export const dynamic = "force-dynamic";
export default async function ProfilePage() {
  const { id: _id, updatedAt: _u, ...p } = await prisma.profile.upsert({ where: { id: "default" }, create: { id: "default" }, update: {} });
  return (
    <main className="mx-auto max-w-lg space-y-4 p-6">
      <h1 className="text-2xl font-bold">Travel preferences</h1>
      <p className="text-sm text-slate-600">Used by the chat planner. Prices are converted to your display currency.</p>
      <ProfileForm initial={p} />
    </main>
  );
}
