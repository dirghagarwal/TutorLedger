"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { IndianRupee, Plus, Wallet, Search } from "lucide-react";

import PaymentDialog, { type PaymentDraft } from "@/components/workspace/PaymentDialog";
import { recordPayment } from "@/app/actions/workflow";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { PaymentStatus, type Payment } from "@/types/payment";
import type { Student } from "@/types/students";

interface StudentBalanceItem {
  student: Student;
  outstandingBalance: number;
  lifetimePaid: number;
}

interface PaymentsClientProps {
  initialPayments: Payment[];
  initialStudentBalances: StudentBalanceItem[];
  students: Student[];
  summary: {
    revenueThisMonth: number;
    revenueThisYear: number;
    totalPendingFees: number;
  };
}

const currencyFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

export default function PaymentsClient({
  initialPayments,
  initialStudentBalances,
  students,
  summary,
}: Readonly<PaymentsClientProps>) {
  const router = useRouter();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [selectedStudentForPayment, setSelectedStudentForPayment] = useState<Student | null>(null);

  const studentNameMap = useMemo(
    () => new Map(students.map((s) => [s.id, s.name])),
    [students]
  );

  const filteredPayments = useMemo(() => {
    return initialPayments.filter((payment) => {
      const studentName = studentNameMap.get(payment.studentId) ?? "";
      const matchesSearch =
        studentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        payment.notes.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus =
        statusFilter === "ALL" || payment.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [initialPayments, studentNameMap, searchQuery, statusFilter]);

  async function handlePaymentSubmit(draft: PaymentDraft): Promise<boolean> {
    if (!selectedStudentForPayment) return false;

    const result = await recordPayment({
      studentId: selectedStudentForPayment.id,
      amount: draft.amount,
      date: new Date().toISOString().slice(0, 10),
      method: draft.method,
      status: draft.status,
      billingPeriod: draft.billingPeriod,
      notes: draft.notes,
    });

    if (!result.ok) {
      toast({ title: "Payment failed", description: result.error, variant: "error" });
      return false;
    }

    toast({ title: "Payment recorded", variant: "success" });
    router.refresh();
    setSelectedStudentForPayment(null);
    return true;
  }

  return (
    <div className="space-y-8">
      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="border-border-strong bg-surface text-foreground shadow-card">
          <CardHeader className="flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">This Month</CardTitle>
            <IndianRupee className="size-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {currencyFormatter.format(summary.revenueThisMonth)}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Collected revenue in current month</p>
          </CardContent>
        </Card>

        <Card className="border-border-strong bg-surface text-foreground shadow-card">
          <CardHeader className="flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pending Fees</CardTitle>
            <Wallet className="size-4 text-warning" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-warning">
              {currencyFormatter.format(summary.totalPendingFees)}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Total outstanding accrued balance</p>
          </CardContent>
        </Card>

        <Card className="border-border-strong bg-surface text-foreground shadow-card">
          <CardHeader className="flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">This Year</CardTitle>
            <IndianRupee className="size-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {currencyFormatter.format(summary.revenueThisYear)}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Total revenue collected this year</p>
          </CardContent>
        </Card>
      </div>

      {/* Student Balances Section */}
      <Card className="border-border-strong bg-surface text-foreground shadow-card">
        <CardHeader className="border-b border-border/50 pb-4">
          <CardTitle className="text-lg text-foreground">Student Balances & Quick Payment</CardTitle>
        </CardHeader>
        <CardContent className="divide-y divide-border/40 pt-4">
          {initialStudentBalances.length === 0 ? (
            <p className="py-4 text-sm text-muted-foreground">No students found.</p>
          ) : (
            initialStudentBalances.map(({ student, outstandingBalance, lifetimePaid }) => (
              <div key={student.id} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className="flex size-10 items-center justify-center rounded-xl text-xs font-bold"
                    style={{ backgroundColor: student.color }}
                  >
                    {student.name.split(/\s+/).slice(0, 2).map((p) => p[0] ?? "").join("").toUpperCase()}
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">{student.name}</h3>
                    <p className="text-xs text-muted-foreground">
                      {student.subject} · {student.feeType} (₹{student.fee})
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-4 sm:justify-end">
                  <div className="text-right">
                    <p className={`text-sm font-bold ${outstandingBalance > 0 ? "text-warning" : "text-success"}`}>
                      {outstandingBalance > 0 ? `${currencyFormatter.format(outstandingBalance)} due` : "Fully Paid"}
                    </p>
                    <p className="text-xs text-muted-foreground">Paid: {currencyFormatter.format(lifetimePaid)}</p>
                  </div>

                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setSelectedStudentForPayment(student)}
                  >
                    <Plus className="size-4" />
                    Record
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Transaction History Section */}
      <Card className="border-border-strong bg-surface text-foreground shadow-card">
        <CardHeader className="flex-col gap-4 border-b border-border/50 pb-4 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-lg text-foreground">Transaction History</CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-48">
              <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
              <Input
                placeholder="Search payments..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 text-xs"
              />
            </div>
            <select
              className="h-9 rounded-lg border border-input bg-card px-3 text-xs text-foreground outline-none"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="ALL">All Statuses</option>
              <option value={PaymentStatus.PAID}>Paid</option>
              <option value={PaymentStatus.PENDING}>Pending</option>
              <option value={PaymentStatus.PARTIAL}>Partial</option>
            </select>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border/50 bg-surface-subtle/80 text-xs text-muted-foreground uppercase">
                <tr>
                  <th className="px-4 py-3">Student</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Method</th>
                  <th className="px-4 py-3">Period</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {filteredPayments.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                      No payments match the filters.
                    </td>
                  </tr>
                ) : (
                  filteredPayments.map((payment) => (
                    <tr key={payment.id} className="hover:bg-muted/40 transition-colors">
                      <td className="px-4 py-3 font-semibold text-foreground">
                        {studentNameMap.get(payment.studentId) ?? "Unknown Student"}
                      </td>
                      <td className="px-4 py-3 font-bold text-foreground">
                        {currencyFormatter.format(payment.amount)}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{payment.date}</td>
                      <td className="px-4 py-3 text-xs text-secondary-foreground">{payment.method}</td>
                      <td className="px-4 py-3 text-xs text-secondary-foreground">{payment.billingPeriod}</td>
                      <td className="px-4 py-3">
                        <Badge
                          variant={
                            payment.status === PaymentStatus.PAID
                              ? "default"
                              : payment.status === PaymentStatus.PENDING
                                ? "destructive"
                                : "outline"
                          }
                        >
                          {payment.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground max-w-xs truncate">
                        {payment.notes || "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Record Payment Dialog */}
      {selectedStudentForPayment && (
        <PaymentDialog
          open={Boolean(selectedStudentForPayment)}
          studentName={selectedStudentForPayment.name}
          onOpenChange={(open) => {
            if (!open) setSelectedStudentForPayment(null);
          }}
          onSubmit={handlePaymentSubmit}
        />
      )}
    </div>
  );
}
