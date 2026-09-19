"use client";

import { useState } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [retrying, setRetrying] = useState(false);

  return (
    <main className="flex min-h-[60vh] items-center justify-center p-6">
      <section
        aria-labelledby="route-error-title"
        className="w-full max-w-lg rounded-3xl border border-border-strong bg-surface p-6 shadow-card sm:p-8"
      >
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">TutorLedger</p>
        <h1 id="route-error-title" className="mt-3 text-2xl font-semibold">
          We couldn&apos;t load this page
        </h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          The workspace is having trouble reaching its data store. No data-changing action was
          requested by this error. Check the connection and try again.
        </p>
        {error?.digest && (
          <p className="mt-3 text-xs text-muted-foreground">
            Reference: <span className="font-mono">{error.digest}</span>
          </p>
        )}
        <button
          type="button"
          className="mt-6 min-h-11 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/85 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60"
          disabled={retrying}
          onClick={() => {
            setRetrying(true);
            reset();
            window.setTimeout(() => setRetrying(false), 1200);
          }}
        >
          {retrying ? "Retrying…" : "Retry connection"}
        </button>
      </section>
    </main>
  );
}
