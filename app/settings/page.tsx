import { requireTeacher } from "@/lib/auth/session";
import { rawPrisma } from "@/lib/db/raw";
import PortalManager from "@/components/settings/PortalManager";
import { logoutTeacher } from "@/app/actions/auth";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const teacher = await requireTeacher();
  const [students, teachers, portals] = await Promise.all([
    rawPrisma.student.findMany({ where: { teacherId: teacher.id, active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    rawPrisma.teacher.findMany({ orderBy: { createdAt: "asc" }, select: { id: true, name: true, email: true } }),
    rawPrisma.parentPortal.findMany({
      where: { teacherId: teacher.id },
      orderBy: { createdAt: "desc" },
      include: { student: { select: { name: true } } },
    }),
  ]);

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-6xl px-5 py-8 sm:px-8">
        <div className="mb-10">
          <p className="text-sm font-medium tracking-[0.24em] text-primary uppercase">Settings</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Workspace & access</h1>
          <p className="mt-2 text-sm text-muted-foreground">Teacher accounts are isolated, and parent links are limited to one student.</p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-3xl border border-border bg-surface p-6 shadow-card">
            <h2 className="text-lg font-semibold">Teacher accounts</h2>
            <p className="mt-1 text-sm text-muted-foreground">Create additional teacher workspaces without sharing student data.</p>
            <div className="mt-5 space-y-3">
              {teachers.map((item: { id: string; name: string; email: string | null }) => (
                <div key={item.id} className="flex items-center justify-between rounded-2xl border border-border bg-background/50 px-4 py-3">
                  <div><p className="font-medium">{item.name}</p><p className="text-xs text-muted-foreground">{item.email ?? "Email not configured"}</p></div>
                  {item.id === teacher.id && <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs text-primary">You</span>}
                </div>
              ))}
            </div>
            <details className="mt-5 rounded-2xl border border-border p-4">
              <summary className="cursor-pointer text-sm font-medium">Add another teacher</summary>
              <form action={async (formData) => {
                "use server";
                const { createTeacherAccount } = await import("@/app/actions/auth");
                await createTeacherAccount(formData);
              }} className="mt-4 grid gap-3">
                <input name="name" required minLength={2} placeholder="Teacher name" className="h-11 rounded-xl border border-input bg-background px-3 text-sm" />
                <input name="email" required type="email" placeholder="Email" className="h-11 rounded-xl border border-input bg-background px-3 text-sm" />
                <input name="password" required minLength={8} type="password" placeholder="Password" className="h-11 rounded-xl border border-input bg-background px-3 text-sm" />
                <button className="h-11 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground">Create teacher</button>
              </form>
            </details>
          </section>

          <section className="rounded-3xl border border-border bg-surface p-6 shadow-card">
            <h2 className="text-lg font-semibold">Parent portals</h2>
            <p className="mt-1 text-sm text-muted-foreground">Create a revocable, expiring read-only link for one student.</p>
            <PortalManager
              students={students}
              portals={portals.map((p: { id: string; showFees: boolean; expiresAt: Date; revokedAt: Date | null; student: { name: string } }) => ({
                id: p.id,
                studentName: p.student.name,
                showFees: p.showFees,
                expiresAt: p.expiresAt.toISOString(),
                revokedAt: p.revokedAt?.toISOString() ?? null,
              }))}
            />
          </section>
        </div>

        <form action={logoutTeacher} className="mt-8">
          <button className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">Sign out</button>
        </form>
      </div>
    </main>
  );
}
