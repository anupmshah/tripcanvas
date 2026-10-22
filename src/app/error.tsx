"use client";
export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="mx-auto max-w-xl space-y-3 p-8">
      <h1 className="text-xl font-bold">Could not load TripCanvas</h1>
      <p>Please retry. If the problem continues, check the server and database connection.</p>
      <button onClick={reset} className="rounded bg-sky-700 px-3 py-2 text-white">
        Retry
      </button>
    </main>
  );
}
