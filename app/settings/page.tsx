import { requireTeacher } from "@/lib/auth/session";
import { rawPrisma } from "@/lib/db/raw";
import PortalManager from "@/components/settings/PortalManager";
import TeacherAccountManager from "@/components/settings/TeacherAccountManager";
import { logoutTeacher } from "@/app/actions/auth";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const teacher = await requireTeacher();
  const [students, portals, allTeachers] = await Promise.all([
    rawPrisma.student.findMany({ where: { teacherId: teacher.id, active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    rawPrisma.parentPortal.findMany({
      where: { teacherId: teacher.id },
      orderBy: { createdAt: "desc" },
      include: { student: { select: { name: true } } },
    }),
    rawPrisma.teacher.findMany({
      select: { id: true, name: true, email: true },
      orderBy: { name: "asc" },
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
            <h2 className="text-lg font-semibold">Teacher accounts & security</h2>
            <p className="mt-1 text-sm text-muted-foreground">Manage profile, rotate password, switch workspace, or provision a second teacher.</p>
            <div className="mt-5">
              <TeacherAccountManager
                currentTeacher={{ id: teacher.id, name: teacher.name, email: teacher.email }}
                availableTeachers={allTeachers}
              />
            </div>
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
