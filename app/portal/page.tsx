import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { getParentPortalCookieName, getStudentPortalCookieName, verifyParentPortalSessionValue, verifyStudentPortalSessionValue } from "@/lib/auth/parent-portal";
import { rawPrisma } from "@/lib/db/raw";
import { calculateLedgerBalance, calculateMonthlyAccruedFee } from "@/lib/services/billing";
import { getTodayDateKey } from "@/lib/utils/date";
import StudentSessionControls from "@/components/portal/StudentSessionControls";

export const dynamic = "force-dynamic";

export default async function PortalPage() {
  const jar = await cookies();
  const studentSession = verifyStudentPortalSessionValue(jar.get(getStudentPortalCookieName())?.value);
  const parentSession = verifyParentPortalSessionValue(jar.get(getParentPortalCookieName())?.value);
  const portalSession = studentSession ?? parentSession;
  const role = studentSession ? "student" : "parent";
  if (!portalSession) notFound();

  const portal = await rawPrisma.parentPortal.findUnique({ where: { id: portalSession.portalId }, include: { student: true, teacher: { select: { name: true } } } });
  if (!portal || portal.revokedAt || portal.expiresAt.getTime() <= Date.now()) notFound();

  const [sessions, notes, attendance, attachments] = await Promise.all([
    rawPrisma.session.findMany({ where: { studentId: portal.studentId, teacherId: portal.teacherId }, orderBy: [{ date: "desc" }, { startTime: "desc" }], take: 80, select: { id: true, date: true, startTime: true, endTime: true, status: true } }),
    rawPrisma.sessionNote.findMany({ where: { session: { studentId: portal.studentId, teacherId: portal.teacherId } }, orderBy: { createdAt: "desc" }, take: 80, select: { sessionId: true, topic: true, classwork: true, homework: true, remarks: true, createdAt: true } }),
    rawPrisma.attendance.findMany({ where: { session: { studentId: portal.studentId, teacherId: portal.teacherId } }, select: { sessionId: true, status: true } }),
    rawPrisma.attachment.findMany({ where: { session: { studentId: portal.studentId, teacherId: portal.teacherId } }, select: { id: true, sessionId: true, filename: true, storagePath: true } }),
  ]);

  const attachmentsBySession = new Map<string, Array<{ id: string; filename: string; storagePath: string }>>();
  for (const att of attachments) attachmentsBySession.set(att.sessionId, [...(attachmentsBySession.get(att.sessionId) ?? []), att]);
  const attendanceStatus = new Map<string, string>();
  for (const row of attendance) attendanceStatus.set(row.sessionId, row.status);
  const notesBySession = new Map<string, typeof notes[number]>();
  for (const note of notes) if (!notesBySession.has(note.sessionId)) notesBySession.set(note.sessionId, note);

  let feeSummary: { outstanding: number; credit: number } | null = null;
  if (role === "parent" && portal.showFees) {
    const payments = await rawPrisma.payment.findMany({ where: { studentId: portal.studentId, teacherId: portal.teacherId }, select: { amount: true, status: true, date: true } });
    const collected = payments.filter((p) => p.status === "PAID" || p.status === "PARTIAL").reduce((sum, p) => sum + p.amount, 0);
    if (portal.student.feeType === "CLASSWISE") {
      const attended = attendance.filter((a) => a.status === "PRESENT").length;
      feeSummary = calculateLedgerBalance(attended * portal.student.fee, collected);
    } else {
      const historicalDates = [...sessions.filter((s) => s.status !== "CANCELLED").map((s) => s.date), ...payments.map((p) => p.date)];
      feeSummary = calculateLedgerBalance(portal.student.fee, collected);
      const accrued = calculateMonthlyAccruedFee(portal.student.fee, getTodayDateKey().slice(0, 7), historicalDates);
      feeSummary = calculateLedgerBalance(accrued, collected);
    }
  }

  return (
    <main className="min-h-screen-safe bg-[#07080c] text-white">
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden="true"><div className="absolute left-1/2 top-0 h-[38rem] w-[50rem] -translate-x-1/2 rounded-full bg-blue-500/[0.07] blur-[120px]" /><div className="absolute right-0 top-1/3 h-[28rem] w-[28rem] rounded-full bg-violet-500/[0.045] blur-[120px]" /></div>
      <div className="relative mx-auto max-w-5xl px-4 py-6 sm:px-8 sm:py-8">
        <header className="mb-7"><div className="flex items-center justify-between gap-3"><div><p className="text-sm text-white/45">TutorLedger · {role === "student" ? "Student Workspace" : "Parent Class Calendar"}</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">{portal.student.name}</h1><p className="mt-1 text-sm text-white/50">{portal.student.subject} · Managed by {portal.teacher.name}</p></div><span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-white/55">{role === "student" ? "Class access" : "Read only"}</span></div></header>

        <section className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-white/8 bg-white/[0.035] p-4"><p className="text-xs text-white/45">Classes shown</p><p className="mt-1 text-2xl font-semibold">{sessions.length}</p></div>
          <div className="rounded-2xl border border-white/8 bg-white/[0.035] p-4"><p className="text-xs text-white/45">Latest class</p><p className="mt-1 text-sm font-medium">{sessions[0]?.date ?? "—"}</p></div>
          {role === "parent" && portal.showFees && feeSummary && <div className="rounded-2xl border border-white/8 bg-white/[0.035] p-4"><p className="text-xs text-white/45">Fee status</p><p className="mt-1 text-sm font-medium">{feeSummary.outstanding > 0 ? `₹${feeSummary.outstanding.toLocaleString("en-IN")} outstanding` : feeSummary.credit > 0 ? `₹${feeSummary.credit.toLocaleString("en-IN")} credit` : "Paid through current ledger"}</p></div>}
        </section>

        <section className="mt-6 overflow-hidden rounded-3xl border border-white/8 bg-white/[0.025]">
          <div className="border-b border-white/8 px-5 py-4"><h2 className="font-medium">{role === "student" ? "My classes & class records" : "Class calendar & history"}</h2><p className="mt-1 text-xs text-white/45">{role === "student" ? "Update the record for your own classes, timing, homework and attachments." : "Review the classes completed and what was covered."}</p></div>
          <div className="divide-y divide-white/6">
            {sessions.map((session) => { const note = notesBySession.get(session.id); const sessionAtts = attachmentsBySession.get(session.id) ?? []; return <article key={session.id} className="px-5 py-5"><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="font-medium">{session.date}</p><p className="text-xs text-white/45">{session.startTime}–{session.endTime}</p></div><span className={`rounded-full border px-2.5 py-1 text-xs ${session.status === "CANCELLED" ? "border-red-500/20 bg-red-500/10 text-red-400" : "border-white/8 text-white/60"}`}>{attendanceStatus.get(session.id) ?? session.status}</span></div>{note && <div className="mt-4 grid gap-3 sm:grid-cols-3">{note.topic && <Info label="Topic" value={note.topic} />}{note.classwork && <Info label="Classwork" value={note.classwork} />}{note.homework && <Info label="Homework" value={note.homework} />}</div>}{role === "student" && <StudentSessionControls sessionId={session.id} initialTopic={note?.topic ?? ""} initialClasswork={note?.classwork ?? ""} startTime={session.startTime} endTime={session.endTime} status={session.status} attachments={sessionAtts} />}{role === "parent" && sessionAtts.length > 0 && <div className="mt-4 flex flex-wrap gap-2">{sessionAtts.map((att) => <a key={att.id} href={att.storagePath} download={att.filename} className="rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1 text-xs text-white/70">{att.filename}</a>)}</div>}</article>; })}
            {sessions.length === 0 && <p className="px-5 py-10 text-center text-sm text-white/45">No classes have been shared yet.</p>}
          </div>
        </section>
        <p className="mt-6 text-center text-xs text-white/30">{role === "student" ? "Only your own class records are editable." : "This parent view is read-only."}</p>
      </div>
    </main>
  );
}

function Info({ label, value }: { label: string; value: string }) { return <div className="rounded-xl border border-white/6 bg-black/10 p-3"><p className="text-[11px] uppercase tracking-wider text-white/35">{label}</p><p className="mt-1 whitespace-pre-wrap text-sm text-white/75">{value}</p></div>; }
