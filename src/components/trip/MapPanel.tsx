"use client";
import dynamic from "next/dynamic";

const MapView = dynamic(() => import("./MapView"), {
  ssr: false,
  loading: () => (
    <div className="grid h-[55vh] animate-pulse place-items-center rounded-lg bg-slate-200 text-sm text-slate-500">
      Loading map…
    </div>
  ),
});
export default MapView;
