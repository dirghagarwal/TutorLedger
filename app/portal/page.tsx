import { cookies } from "next/headers";
import { notFound } from "next/navigation";

import { getParentPortalCookieName, verifyParentPortalSessionValue } from "@/lib/auth/parent-portal";
import { rawPrisma } from "@/lib/db/raw";
import { calculateLedgerBalance, calculateMonthlyAccruedFee } from "@/lib/services/billing";
import { getTodayDateKey } from "@/lib/utils/date";

export const dynamic = "force-dynamic";

export default async function ParentPortalPage() {
  const cookie = (await cookies()).get(getParentPortalCookieName());
  const portalSession = verifyParentPortalSessionValue(cookie?.value);
  if (!portalSession) notFound();

  const portal = await rawPrisma.parentPortal.findUnique({
    where: { id: portalSession.portalId },
    include: { student: true, teacher: { select: { name: true } } },
  });

  if (!portal || portal.revokedAt || portal.expiresAt.getTime() <= Date.now()) notFound();

  const [sessions, notes, attendance] = await Promise.all([
    rawPrisma.session.findMany({
      where: { studentId: portal.studentId, teacherId: portal.teacherId },
      orderBy: [{ date: "desc" }, { startTime: "desc" }],
      take: 40,
      select: { id: true, date: true, startTime: true, endTime: true, status: true },
    }),
    rawPrisma.sessionNote.findMany({
      where: { session: { studentId: portal.studentId, teacherId: portal.teacherId } },
      orderBy: { createdAt: "desc" },
      take: 40,
      select: { sessionId: true, topic: true, classwork: true, homework: true, remarks: true, createdAt: true },
    }),
    rawPrisma.attendance.findMany({
      where: { session: { studentId: portal.studentId, teacherId: portal.teacherId } },
      select: { sessionId: true, status: true },
    }),
  ]);

  const attendanceStatus = new Map(
    attendance.map((row: { sessionId: string; status: string }) => [row.sessionId, row.status]),
  );
  type SessionNoteRow = {
    sessionId: string;
    topic: string;
    classwork: string;
    homework: string;
    remarks: string;
    createdAt: Date;
  };
  const notesBySession = new Map<string, SessionNoteRow>();
  for (const note of notes as SessionNoteRow[]) {
    if (!notesBySession.has(note.sessionId)) notesBySession.set(note.sessionId, note);
  }

  let feeSummary: { outstanding: number; credit: number } | null = null;
  if (portal.showFees) {
    const payments = await rawPrisma.payment.findMany({
      where: { studentId: portal.studentId, teacherId: portal.teacherId },
      select: { amount: true, status: true, date: true },
    });
    const collected = payments
      .filter(
        (payment: { amount: number; status: string; date: string }) =>
          payment.status === "PAID" || payment.status === "PARTIAL",
      )
      .reduce(
        (sum: number, payment: { amount: number; status: string; date: string }) =>
          sum + payment.amount,
        0,
      );

    if (portal.student.feeType === "CLASSWISE") {
      const attendedCount = attendance.filter(
        (row: { sessionId: string; status: string }) => row.status === "PRESENT",
      ).length;
      feeSummary = calculateLedgerBalance(attendedCount * portal.student.fee, collected);
    } else {
      const historicalDates = [
        ...sessions.map((item: { id: string; date: string; startTime: string; endTime: string; status: string }) => item.date),
        ...payments.map((payment: { amount: number; status: string; date: string }) => payment.date),
      ];
      const accrued = calculateMonthlyAccruedFee(
        portal.student.fee,
        getTodayDateKey().slice(0, 7),
        historicalDates,
      );
      feeSummary = calculateLedgerBalance(accrued, collected);
    }
  }

  return (
    <main className="min-h-screen bg-[#07080c] text-white">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-0 h-[38rem] w-[50rem] -translate-x-1/2 rounded-full bg-blue-500/[0.07] blur-[120px]" />
        <div className="absolute right-0 top-1/3 h-[28rem] w-[28rem] rounded-full bg-violet-500/[0.045] blur-[120px]" />
      </div>
      <div className="relative mx-auto max-w-4xl px-5 py-8 sm:px-8">
        <header className="mb-8">
          <p className="text-sm text-white/45">TutorLedger · Parent Portal</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">{portal.student.name}</h1>
          <p className="mt-1 text-sm text-white/50">{portal.student.subject} · Managed by {portal.teacher.name}</p>
        </header>

        <section className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-white/8 bg-white/[0.035] p-4">
            <p className="text-xs text-white/45">Classes shown</p>
            <p className="mt-1 text-2xl font-semibold">{sessions.length}</p>
          </div>
          <div className="rounded-2xl border border-white/8 bg-white/[0.035] p-4">
            <p className="text-xs text-white/45">Latest class</p>
            <p className="mt-1 text-sm font-medium">{sessions[0]?.date ?? "—"}</p>
          </div>
          {portal.showFees && feeSummary && (
            <div className="rounded-2xl border border-white/8 bg-white/[0.035] p-4">
              <p className="text-xs text-white/45">Fee status</p>
              <p className="mt-1 text-sm font-medium">
                {feeSummary.outstanding > 0
                  ? `₹${feeSummary.outstanding.toLocaleString("en-IN")} outstanding`
                  : feeSummary.credit > 0
                    ? `₹${feeSummary.credit.toLocaleString("en-IN")} credit`
                    : "Paid through current ledger"}
              </p>
            </div>
          )}
        </section>

        <section className="mt-6 overflow-hidden rounded-3xl border border-white/8 bg-white/[0.025]">
          <div className="border-b border-white/8 px-5 py-4">
            <h2 className="font-medium">Class history</h2>
            <p className="mt-1 text-xs text-white/45">Attendance, topics and homework shared by your tutor.</p>
          </div>
          <div className="divide-y divide-white/6">
            {sessions.map((session: { id: string; date: string; startTime: string; endTime: string; status: string }) => {
              const note = notesBySession.get(session.id);
              return (
                <article key={session.id} className="px-5 py-5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-medium">{session.date}</p>
                      <p className="text-xs text-white/45">{session.startTime}–{session.endTime}</p>
                    </div>
                    <span className="rounded-full border border-white/8 px-2.5 py-1 text-xs text-white/60">
                      {attendanceStatus.get(session.id) ?? session.status}
                    </span>
                  </div>
                  {note && (
                    <div className="mt-4 grid gap-3 sm:grid-cols-3">
                      {note.topic && <Info label="Topic" value={note.topic} /> }
                      {note.classwork && <Info label="Classwork" value={note.classwork} /> }
                      {note.homework && <Info label="Homework" value={note.homework} /> }
                    </div>
                  )}
                </article>
              );
            })}
            {sessions.length === 0 && <p className="px-5 py-10 text-center text-sm text-white/45">No classes have been shared yet.</p>}
          </div>
        </section>

        <p className="mt-6 text-center text-xs text-white/30">This private portal session is read-only and can be revoked by the tutor.</p>
      </div>
    </main>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/6 bg-black/10 p-3">
      <p className="text-[11px] uppercase tracking-wider text-white/35">{label}</p>
      <p className="mt-1 whitespace-pre-wrap text-sm text-white/75">{value}</p>
    </div>
  );
}