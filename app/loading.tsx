export default function Loading() {
  return (
    <main className="grid min-h-screen place-items-center bg-background text-foreground">
      <div className="text-center">
        <div className="mx-auto size-7 animate-pulse rounded-full bg-primary/60 shadow-[0_0_45px_rgba(99,102,241,0.18)]" />
        <p className="mt-4 text-xs text-muted-foreground">Loading TutorLedger…</p>
      </div>
    </main>
  );
}
