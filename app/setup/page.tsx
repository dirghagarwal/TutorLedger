import { setupTeacher } from "@/app/actions/auth";
import { rawPrisma } from "@/lib/db/raw";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function SetupPage({
  searchParams,
}: { searchParams: Promise<{ error?: string }> }) {
  const teacher = await rawPrisma.teacher.findFirst({ orderBy: { createdAt: "asc" } });
  if (!teacher || teacher.passwordHash) redirect("/login");
  if (
    process.env.NODE_ENV === "production" &&
    !process.env.TUTORLEDGER_SETUP_KEY &&
    !process.env.REGISTRATION_INVITE_CODE
  ) {
    redirect("/login?error=setup-disabled");
  }

  const { error } = await searchParams;

  return (
    <main className="min-h-screen bg-background text-foreground grid place-items-center px-5">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500/30 via-violet-500/20 to-transparent ring-1 ring-white/10">
            <span className="text-lg font-semibold">TL</span>
          </div>
          <h1 className="text-3xl font-semibold tracking-tight">Set up TutorLedger</h1>
          <p className="mt-2 text-sm text-muted-foreground">Claim the existing workspace using the private setup key. Existing ledger data stays attached to this workspace.</p>
        </div>
        <form action={setupTeacher} className="rounded-3xl border border-white/10 bg-white/[0.035] p-6 shadow-2xl shadow-black/30 backdrop-blur-xl">
          {error && <p className="mb-4 rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">Please enter a valid name, email and password of at least 8 characters.</p>}
          <label className="mb-2 block text-sm text-muted-foreground" htmlFor="name">Your name</label>
          <input id="name" name="name" required className="mb-4 h-12 w-full rounded-xl border border-white/10 bg-black/20 px-4 outline-none focus:ring-2 focus:ring-primary/30" />
          <label className="mb-2 block text-sm text-muted-foreground" htmlFor="email">Email</label>
          <input id="email" name="email" type="email" required className="mb-4 h-12 w-full rounded-xl border border-white/10 bg-black/20 px-4 outline-none focus:ring-2 focus:ring-primary/30" />
          <label className="mb-2 block text-sm text-muted-foreground" htmlFor="setupKey">Setup key or registration invite code</label>
          <input id="setupKey" name="setupKey" type="password" required autoComplete="off" className="mb-4 h-12 w-full rounded-xl border border-white/10 bg-black/20 px-4 outline-none focus:ring-2 focus:ring-primary/30" />

          <label className="mb-2 block text-sm text-muted-foreground" htmlFor="password">Password</label>
          <input id="password" name="password" type="password" minLength={8} required autoComplete="new-password" className="h-12 w-full rounded-xl border border-white/10 bg-black/20 px-4 outline-none focus:ring-2 focus:ring-primary/30" />
          <button className="mt-5 h-12 w-full rounded-xl bg-white text-black font-medium hover:opacity-90" type="submit">Create workspace</button>
        </form>
      </div>
    </main>
  );
}
