"use client";

import { useRef, useState, useTransition } from "react";
import { Check, Loader2, UserPlus } from "lucide-react";
import { createTeacherAccount } from "@/app/actions/team";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

type Teacher = { id: string; name: string; email: string | null; createdAt: string };

export default function TeamManagement({
  teachers,
  currentTeacherId,
}: {
  teachers: Teacher[];
  currentTeacherId: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [isPending, startTransition] = useTransition();
  const [created, setCreated] = useState(false);
  const { toast } = useToast();

  function submit(formData: FormData) {
    setCreated(false);
    startTransition(async () => {
      const result = await createTeacherAccount(formData);
      if (!result.ok) {
        toast({ title: "Could not create account", description: result.error, variant: "error" });
        return;
      }
      formRef.current?.reset();
      setCreated(true);
      toast({ title: "Teacher account created", variant: "success" });
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1.1fr_.9fr]">
      <section className="rounded-3xl border border-white/8 bg-white/[0.025] p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-white/35">Workspace</p>
            <h2 className="mt-2 text-lg font-semibold">Teacher accounts</h2>
            <p className="mt-1 text-sm text-white/45">Each teacher gets a private workspace. Your student and payment data stays isolated by account.</p>
          </div>
          <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-blue-400/10 text-blue-200 ring-1 ring-blue-300/10">
            <UserPlus className="size-4" />
          </div>
        </div>

        <div className="mt-5 space-y-2">
          {teachers.map((teacher) => (
            <div key={teacher.id} className="flex items-center gap-3 rounded-2xl border border-white/6 bg-black/15 px-4 py-3">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-white/[0.06] text-sm font-semibold">
                {teacher.name.slice(0, 1).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{teacher.name}{teacher.id === currentTeacherId ? " · You" : ""}</p>
                <p className="truncate text-xs text-white/40">{teacher.email ?? "Email not set"}</p>
              </div>
              <Check className="size-4 text-emerald-300/70" aria-label="Active account" />
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-3xl border border-white/8 bg-white/[0.025] p-5 sm:p-6">
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-white/35">Invite by creating credentials</p>
        <h2 className="mt-2 text-lg font-semibold">Add a teacher</h2>
        <p className="mt-1 text-sm text-white/45">Share the email and password securely with the teacher. They can sign in from the TutorLedger login page.</p>

        <form ref={formRef} action={submit} className="mt-5 space-y-3">
          <input name="name" required minLength={2} maxLength={80} placeholder="Teacher name" className="h-11 w-full rounded-xl border border-white/8 bg-black/20 px-3 text-sm outline-none focus:border-blue-300/30 focus:ring-2 focus:ring-blue-300/10" />
          <input name="email" required type="email" placeholder="teacher@example.com" className="h-11 w-full rounded-xl border border-white/8 bg-black/20 px-3 text-sm outline-none focus:border-blue-300/30 focus:ring-2 focus:ring-blue-300/10" />
          <input name="password" required minLength={8} maxLength={128} type="password" autoComplete="new-password" placeholder="Temporary password (8+ characters)" className="h-11 w-full rounded-xl border border-white/8 bg-black/20 px-3 text-sm outline-none focus:border-blue-300/30 focus:ring-2 focus:ring-blue-300/10" />
          <Button type="submit" disabled={isPending} className="h-11 w-full rounded-xl bg-white text-black hover:bg-white/90">
            {isPending ? <Loader2 className="size-4 animate-spin" /> : <UserPlus className="size-4" />}
            {isPending ? "Creating…" : "Create teacher account"}
          </Button>
          {created && <p className="text-xs text-emerald-300">Account created successfully.</p>}
        </form>
      </section>
    </div>
  );
}
