import { Banknote, CalendarDays } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BillingPeriod, PaymentMethod, PaymentStatus, type Payment } from "@/types/payment";

interface PaymentHistoryProps {
  payments: readonly Payment[];
  outstandingBalance: number;
  lifetimePayments: number;
}

const methodLabels: Record<PaymentMethod, string> = {
  [PaymentMethod.CASH]: "Cash",
  [PaymentMethod.UPI]: "UPI",
  [PaymentMethod.BANK_TRANSFER]: "Bank transfer",
  [PaymentMethod.CARD]: "Card",
};

const periodLabels: Record<BillingPeriod, string> = {
  [BillingPeriod.MONTHLY]: "Monthly",
  [BillingPeriod.CLASSWISE]: "Class-wise",
};

const statusStyles: Record<PaymentStatus, string> = {
  [PaymentStatus.PAID]:
    "border-success/20 bg-success/10 text-success",
  [PaymentStatus.PARTIAL]:
    "border-warning/20 bg-warning/10 text-warning",
  [PaymentStatus.PENDING]: "border-destructive/20 bg-destructive/10 text-destructive",
};

const currencyFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

export default function PaymentHistory({
  lifetimePayments,
  outstandingBalance,
  payments,
}: Readonly<PaymentHistoryProps>) {
  return (
    <Card className="border-border-strong bg-surface text-foreground shadow-card">
      <CardHeader className="border-b border-border/50 pb-4">
        <div className="flex items-center justify-between gap-4">
          <CardTitle className="text-lg text-foreground">Payment history</CardTitle>
          <Badge className="border-primary/20 bg-primary/10 text-primary" variant="outline">
            {payments.length} records
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-5">
        <div className="mb-5 grid gap-3 sm:grid-cols-2">
          <Summary label="Outstanding balance" value={currencyFormatter.format(outstandingBalance)} />
          <Summary label="Lifetime payments" value={currencyFormatter.format(lifetimePayments)} />
        </div>
        {payments.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No payment history yet.</p>
        ) : (
          <div className="space-y-3">
            {payments.map((payment) => (
              <div
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/50 bg-muted p-4"
                key={payment.id}
              >
                <div className="flex items-start gap-3">
                  <Banknote className="mt-0.5 size-4 text-primary" />
                  <div>
                    <p className="font-medium text-foreground">
                      {currencyFormatter.format(payment.amount)}
                    </p>
                    <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <CalendarDays className="size-3.5" />
                      {payment.date} · {methodLabels[payment.method]} · {periodLabels[payment.billingPeriod]}
                    </p>
                    {payment.notes && (
                      <p className="mt-1 text-xs text-muted-foreground">{payment.notes}</p>
                    )}
                  </div>
                </div>
                <Badge className={statusStyles[payment.status]} variant="outline">
                  {payment.status}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Summary({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <div className="rounded-xl border border-border/50 bg-muted p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-2 font-semibold text-foreground">{value}</p>
    </div>
  );
}
