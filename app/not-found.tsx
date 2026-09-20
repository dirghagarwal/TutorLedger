import Link from "next/link";

export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center bg-background px-5 text-foreground">
      <div className="w-full max-w-md text-center">
        <div className="text-sm font-semibold tracking-[0.2em] text-primary uppercase">TutorLedger</div>
        <h1 className="mt-4 text-4xl font-semibold">Page not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">The page you requested does not exist.</p>
        <Link href="/" className="mt-6 inline-flex h-11 items-center rounded-xl bg-primary px-5 text-sm font-medium text-primary-foreground">Back to workspace</Link>
      </div>
    </main>
  );
}
