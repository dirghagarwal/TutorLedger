import Sidebar from "@/components/layout/Sidebar";
import Topbar from "@/components/layout/Topbar";
import CommandBar from "@/components/workspace/CommandBar";
import Stats from "@/components/workspace/Stats";
import RightPanel from "@/components/layout/RightPanel";
import type { SessionView } from "@/components/layout/RightPanel";
import { formatTime } from "@/lib/services/schedule";
import {
  getAllSessions,
  getNextSession,
  getTodaysSessions,
} from "@/lib/services/sessions";
import { findStudents } from "@/lib/repositories/students";
import {
  getRevenueThisMonth,
  getTotalOutstandingBalance,
} from "@/lib/services/payments";

export const dynamic = "force-dynamic";

export default async function Home() {
  const students = await findStudents();
  const studentNames = new Map(students.map((student) => [student.id, student.name]));
  const allSessions = await getAllSessions();
  const todaySessions: SessionView[] = (await getTodaysSessions(allSessions)).map(
    (session) => ({
      session,
      studentName: studentNames.get(session.studentId) ?? "Unknown student",
    })
  );
  const nextSession = await getNextSession(allSessions);
  const nextSessionView = nextSession
    ? {
        session: nextSession,
        studentName:
          studentNames.get(nextSession.studentId) ?? "Unknown student",
      }
    : null;
  const pendingFees = await getTotalOutstandingBalance(students);
  const revenueThisMonth = await getRevenueThisMonth();

  return (
    <main className="flex h-screen bg-background">
      <Sidebar />

      <section className="flex flex-1 flex-col">
        <Topbar />

        <div className="p-8">
          <CommandBar />
          <Stats
            cards={[
              { title: "Students", value: String(students.length) },
              { title: "Today's Sessions", value: String(todaySessions.length) },
              {
                title: "Next Session",
                value: nextSessionView
                  ? formatTime(nextSessionView.session.startTime)
                  : "None",
              },
              {
                title: "Pending Fees",
                value: new Intl.NumberFormat("en-IN", {
                  style: "currency",
                  currency: "INR",
                  maximumFractionDigits: 0,
                }).format(pendingFees),
              },
              {
                title: "Revenue This Month",
                value: new Intl.NumberFormat("en-IN", {
                  style: "currency",
                  currency: "INR",
                  maximumFractionDigits: 0,
                }).format(revenueThisMonth),
              },
            ]}
          />
        </div>
      </section>

      <RightPanel
        nextSession={nextSessionView}
        todaySessions={todaySessions}
      />
    </main>
  );
}
