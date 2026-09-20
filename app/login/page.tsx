import Link from "next/link";

import { loginTeacher } from "@/app/actions/auth";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;

  return (
    <main className="min-h-screen bg-background text-foreground grid place-items-center px-5">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500/30 via-violet-500/20 to-transparent ring-1 ring-white/10">
            <span className="text-lg font-semibold">TL</span>
          </div>
          <h1 className="text-3xl font-semibold tracking-tight">Welcome back</h1>
          <p className="mt-2 text-sm text-muted-foreground">Sign in to your TutorLedger workspace.</p>
        </div>

        <form action={loginTeacher} className="rounded-3xl border border-white/10 bg-white/[0.035] p-6 shadow-2xl shadow-black/30 backdrop-blur-xl">
          {error === "setup-disabled" && (
            <p className="mb-4 rounded-xl border border-warning/20 bg-warning/10 px-3 py-2 text-sm text-warning">
              Initial workspace setup is disabled until the owner configures the server-side setup key.
            </p>
          )}
          {error === "invalid" && (
            <p className="mb-4 rounded-xl border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              Incorrect email or password.
            </p>
          )}
          <label className="mb-2 block text-sm text-muted-foreground" htmlFor="email">Email</label>
          <input id="email" name="email" type="email" required autoComplete="email" className="mb-4 h-12 w-full rounded-xl border border-white/10 bg-black/20 px-4 outline-none ring-primary/30 focus:ring-2" />
          <label className="mb-2 block text-sm text-muted-foreground" htmlFor="password">Password</label>
          <input id="password" name="password" type="password" required minLength={8} autoComplete="current-password" className="h-12 w-full rounded-xl border border-white/10 bg-black/20 px-4 outline-none ring-primary/30 focus:ring-2" />
          <button className="mt-5 h-12 w-full rounded-xl bg-white text-black font-medium transition-opacity hover:opacity-90" type="submit">
            Sign in
          </button>
        </form>
        <p className="mt-4 text-center text-xs text-muted-foreground">
          Your workspace is private to your teacher account. <Link href="/register" className="text-foreground underline underline-offset-4">Create an account</Link>
        </p>
      </div>
    </main>
  );
}
