import { redirect } from "next/navigation";
import Sidebar from "@/components/layout/Sidebar";
import Topbar from "@/components/layout/Topbar";
import TeamManagement from "@/components/settings/TeamManagement";
import { getCurrentTeacher } from "@/lib/auth/session";
import { rawPrisma } from "@/lib/db/raw";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const teacher = await getCurrentTeacher();
  if (!teacher) redirect("/login");

  const teachers = await rawPrisma.teacher.findMany({
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, email: true, createdAt: true },
  });

  return (
    <main className="min-h-screen bg-background text-foreground lg:flex">
      <Sidebar />
      <section className="min-w-0 flex-1">
        <Topbar />
        <div className="relative overflow-hidden px-5 py-8 sm:px-8">
          <div className="pointer-events-none absolute inset-0 ambient-gradient opacity-80" />
          <div className="relative mx-auto max-w-5xl">
            <div className="mb-8">
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-white/35">Settings</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-[-0.03em]">Workspace</h1>
              <p className="mt-2 text-sm text-white/45">Manage the people who can access TutorLedger.</p>
            </div>
            <TeamManagement
              currentTeacherId={teacher.id}
              teachers={teachers.map((item) => ({ ...item, createdAt: item.createdAt.toISOString() }))}
            />
          </div>
        </div>
      </section>
    </main>
  );
}
