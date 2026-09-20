import Link from "next/link";

import { registerTeacher } from "@/app/actions/auth";

export const dynamic = "force-dynamic";

export default async function RegisterPage({
  searchParams,
}: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;

  return (
    <main className="grid min-h-screen place-items-center bg-background px-5 text-foreground">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500/30 via-violet-500/20 to-transparent ring-1 ring-white/10">
            <span className="text-lg font-semibold">TL</span>
          </div>
          <h1 className="text-3xl font-semibold tracking-tight">Create your workspace</h1>
          <p className="mt-2 text-sm text-muted-foreground">Start a private TutorLedger teacher account.</p>
        </div>

        <form action={registerTeacher} className="rounded-3xl border border-white/10 bg-white/[0.035] p-6 shadow-2xl shadow-black/30 backdrop-blur-xl">
          {error === "invalid" && (
            <p className="mb-4 rounded-xl border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              Enter a name, valid email, and password of at least 8 characters.
            </p>
          )}
          {error === "exists" && (
            <p className="mb-4 rounded-xl border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              An account with that email already exists.
            </p>
          )}

          <label className="mb-2 block text-sm text-muted-foreground" htmlFor="name">Your name</label>
          <input id="name" name="name" required minLength={2} autoComplete="name" className="mb-4 h-12 w-full rounded-xl border border-white/10 bg-black/20 px-4 outline-none focus:ring-2 focus:ring-primary/30" />

          <label className="mb-2 block text-sm text-muted-foreground" htmlFor="email">Email</label>
          <input id="email" name="email" type="email" required autoComplete="email" className="mb-4 h-12 w-full rounded-xl border border-white/10 bg-black/20 px-4 outline-none focus:ring-2 focus:ring-primary/30" />

          <label className="mb-2 block text-sm text-muted-foreground" htmlFor="password">Password</label>
          <input id="password" name="password" type="password" minLength={8} required autoComplete="new-password" className="h-12 w-full rounded-xl border border-white/10 bg-black/20 px-4 outline-none focus:ring-2 focus:ring-primary/30" />

          <button className="mt-5 h-12 w-full rounded-xl bg-white font-medium text-black transition-opacity hover:opacity-90" type="submit">
            Create account
          </button>
        </form>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          Already have an account? <Link href="/login" className="text-foreground underline underline-offset-4">Sign in</Link>
        </p>
      </div>
    </main>
  );
}
