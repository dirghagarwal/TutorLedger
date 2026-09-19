"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/button";

export default function Error({
  reset,
}: Readonly<{
  error: Error & { digest?: string };
  reset: () => void;
}>) {
  useEffect(() => {
    // Keep production error details out of the UI while retaining a client-side
    // recovery path for transient database/network failures.
    console.error("TutorLedger route error", error);
  }, [error]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-5 py-12">
      <section className="w-full max-w-lg rounded-3xl border border-border-strong bg-surface p-8 text-center shadow-card">
        <p className="text-sm font-medium tracking-[0.24em] text-primary uppercase">
          TutorLedger
        </p>
        <h1 className="mt-3 text-2xl font-semibold text-foreground">
          We couldn&apos;t load this page
        </h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Your tuition data may be temporarily unavailable. Retry the page before making any changes to your records.
        </p>
        <Button className="mt-6" onClick={() => reset()}>
          Retry
        </Button>
      </section>
    </main>
  );
}
