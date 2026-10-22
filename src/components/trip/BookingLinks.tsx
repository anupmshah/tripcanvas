import type { ItemDTO } from "@/lib/dto";
export default function BookingLinks({ item }: { item: ItemDTO }) {
  return (
    <div className="my-1 flex flex-wrap gap-x-2 gap-y-1 text-xs">
      {item.links.map((l) => (
        <a
          key={l.label}
          href={l.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sky-700 underline"
        >
          {l.label} ↗
        </a>
      ))}
    </div>
  );
}
