"use client";

import { useSearchParams } from "next/navigation";
import { useActionState } from "react";
import { claimLegacyTeacher } from "@/app/actions/auth";

export default function ClaimPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const error = searchParams.get("error");
  const [message, action, pending] = useActionState(
    async (_prev: string | null, formData: FormData) => {
      await claimLegacyTeacher(formData);
      return null;
    },
    null,
  );

  return (
    <main className="min-h-screen bg-background text-foreground grid place-items-center px-5">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500/30 via-violet-500/20 to-transparent ring-1 ring-white/10">
            <span className="text-lg font-semibold">TL</span>
          </div>
          <h1 className="text-3xl font-semibold tracking-tight">Claim your workspace</h1>
          <p className="mt-2 text-sm text-muted-foreground">Securely activate the existing TutorLedger workspace.</p>
        </div>
        <form action={action} className="rounded-3xl border border-white/10 bg-white/[0.035] p-6 shadow-2xl shadow-black/30 backdrop-blur-xl">
          <input type="hidden" name="token" value={token} />
          <p className="mb-5 rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-muted-foreground">
            Account: <span className="text-foreground">dirgh.agarwal@gmail.com</span>
          </p>
          <label className="mb-2 block text-sm text-muted-foreground" htmlFor="password">Choose your password</label>
          <input id="password" name="password" type="password" required minLength={8} maxLength={128} autoComplete="new-password"
            className="h-12 w-full rounded-xl border border-white/10 bg-black/20 px-4 outline-none ring-primary/30 focus:ring-2" />
          {error === "invalid" && (
            <p className="mt-3 rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-200">This claim link is invalid or has expired.</p>
          )}
          {message && <p className="mt-3 rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-200">{message}</p>}
          <button className="mt-5 h-12 w-full rounded-xl bg-white text-black font-medium transition-opacity hover:opacity-90 disabled:opacity-50" type="submit" disabled={!token || pending}>
            {pending ? "Activating…" : "Activate workspace"}
          </button>
        </form>
      </div>
    </main>
  );
}
