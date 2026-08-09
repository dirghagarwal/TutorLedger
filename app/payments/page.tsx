import Sidebar from "@/components/layout/Sidebar";
import Topbar from "@/components/layout/Topbar";
import PaymentsClient from "@/components/payments/PaymentsClient";
import { findPayments } from "@/lib/repositories/payments";
import { findStudents } from "@/lib/repositories/students";
import { findSessions } from "@/lib/repositories/sessions";
import { findAttendance } from "@/lib/repositories/attendance";
import {
  getLifetimePayments,
  getOutstandingBalance,
  getRevenueThisMonth,
  getRevenueThisYear,
  getTotalOutstandingBalance,
} from "@/lib/services/payments";

export const dynamic = "force-dynamic";

export default async function PaymentsPage() {
  const [students, payments, sessions, attendance] = await Promise.all([
    findStudents(),
    findPayments(),
    findSessions(),
    findAttendance(),
  ]);

  const [revenueThisMonth, revenueThisYear, totalPendingFees] = await Promise.all([
    getRevenueThisMonth(payments),
    getRevenueThisYear(payments),
    getTotalOutstandingBalance(students, payments, sessions, attendance),
  ]);

  const studentBalances = await Promise.all(
    students.map(async (student) => {
      const [outstanding, paid] = await Promise.all([
        getOutstandingBalance(student.id, payments, students, sessions, attendance),
        getLifetimePayments(student.id, payments),
      ]);
      return {
        student,
        outstandingBalance: outstanding,
        lifetimePaid: paid,
      };
    })
  );

  return (
    <main className="flex min-h-screen bg-background">
      <Sidebar />
      <section className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <div className="flex-1 p-5 sm:p-8">
          <div className="mb-6">
            <p className="text-sm font-medium tracking-[0.24em] text-primary uppercase">
              Financial Management
            </p>
            <h1 className="mt-1 text-2xl font-bold text-foreground sm:text-3xl">
              Payments & Earnings
            </h1>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
              Track fee collections, outstanding balances, and recorded transaction records.
            </p>
          </div>

          <PaymentsClient
            initialPayments={payments}
            initialStudentBalances={studentBalances}
            students={students}
            summary={{
              revenueThisMonth,
              revenueThisYear,
              totalPendingFees,
            }}
          />
        </div>
      </section>
    </main>
  );
}
