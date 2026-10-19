import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = { title: "TripCanvas", description: "AI trip planner with editable itinerary, map and cost estimates" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen font-sans antialiased">
        <header className="no-print flex items-center gap-4 border-b bg-white px-4 py-2">
          <Link href="/" className="text-lg font-bold text-sky-700">TripCanvas</Link>
          <Link href="/profile" className="ml-auto text-sm text-slate-600 hover:underline">Preferences</Link>
        </header>
        {children}
      </body>
    </html>
  );
}
