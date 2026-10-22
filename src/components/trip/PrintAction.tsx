"use client";
import { useEffect, useRef } from "react";
export default function PrintAction() {
  const started = useRef(false);
  useEffect(() => { if (!started.current) { started.current = true; document.fonts.ready.then(() => window.print()); } }, []);
  return <div className="no-print mx-auto max-w-4xl p-3 text-sm"><button onClick={() => window.print()} className="rounded border bg-white px-3 py-2">Print / Save as PDF</button><span className="ml-3">Choose “Save as PDF” in your browser’s print dialog.</span></div>;
}
