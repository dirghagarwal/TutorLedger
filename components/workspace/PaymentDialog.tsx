"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { BillingPeriod, PaymentMethod, PaymentStatus } from "@/types/payment";
import { getTodayDateKey } from "@/lib/utils/date";

export interface PaymentDraft {
  amount: number;
  date: string;
  method: PaymentMethod;
  status: PaymentStatus;
  billingPeriod: BillingPeriod;
  coveredMonth?: string | null;
  coveredFromDate?: string | null;
  coveredToDate?: string | null;
  coveredClassCount?: number | null;
  notes: string;
}

interface PaymentDialogProps {
  open: boolean;
  studentName: string;
  onOpenChange: (open: boolean) => void;
  onSubmit: (draft: PaymentDraft) => Promise<boolean>;
  defaultBillingPeriod?: BillingPeriod;
}

export default function PaymentDialog({ open, studentName, onOpenChange, onSubmit, defaultBillingPeriod = BillingPeriod.MONTHLY }: Readonly<PaymentDialogProps>) {
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(() => getTodayDateKey());
  const [method, setMethod] = useState<PaymentMethod>(PaymentMethod.UPI);
  const [status, setStatus] = useState<PaymentStatus>(PaymentStatus.PAID);
  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>(defaultBillingPeriod);
  const [coveredMonth, setCoveredMonth] = useState(() => getTodayDateKey().slice(0, 7));
  const [coveredFromDate, setCoveredFromDate] = useState("");
  const [coveredToDate, setCoveredToDate] = useState("");
  const [coveredClassCount, setCoveredClassCount] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [coverageError, setCoverageError] = useState("");

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCoverageError("");
    if (billingPeriod === BillingPeriod.CLASSWISE) {
      if (!coveredFromDate || !coveredToDate || !coveredClassCount) {
        setCoverageError("Select the coverage dates and number of classes covered by this payment.");
        return;
      }
      if (coveredFromDate > coveredToDate) {
        setCoverageError("Coverage end date must be on or after the start date.");
        return;
      }
    }
    if (billingPeriod === BillingPeriod.MONTHLY && !coveredMonth) {
      setCoverageError("Select the month this payment covers.");
      return;
    }
    setSaving(true);
    const succeeded = await onSubmit({
      amount: Number(amount), date, method, status, billingPeriod,
      coveredMonth: billingPeriod === BillingPeriod.MONTHLY ? coveredMonth : null,
      coveredFromDate: billingPeriod === BillingPeriod.CLASSWISE ? coveredFromDate : null,
      coveredToDate: billingPeriod === BillingPeriod.CLASSWISE ? coveredToDate : null,
      coveredClassCount: billingPeriod === BillingPeriod.CLASSWISE ? Number(coveredClassCount) : null,
      notes,
    });
    setSaving(false);
    if (!succeeded) return;
    setAmount("");
    setDate(getTodayDateKey());
    setCoveredMonth(getTodayDateKey().slice(0, 7));
    setCoveredFromDate("");
    setCoveredToDate("");
    setCoveredClassCount("");
    setNotes("");
    setBillingPeriod(defaultBillingPeriod);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%-1rem)] border-border-strong bg-surface text-foreground sm:max-w-lg">
        <DialogHeader><DialogTitle>Record payment</DialogTitle><DialogDescription>Record a payment from {studentName} and specify exactly what the payment covers.</DialogDescription></DialogHeader>
        <form className="grid max-h-[min(78dvh,720px)] gap-4 overflow-y-auto pr-1" onSubmit={(event) => void submit(event)}>
          <div className="grid gap-4 sm:grid-cols-2">
            <label htmlFor="payment-amount" className="grid gap-1.5 text-sm font-medium">Amount<Input id="payment-amount" min={1} required type="number" value={amount} onChange={(event) => setAmount(event.target.value)} /></label>
            <label className="grid gap-1.5 text-sm font-medium">Payment date<Input required type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <label htmlFor="payment-method" className="grid gap-1.5 text-sm font-medium">Method<select id="payment-method" className="min-h-11 rounded-lg border border-input bg-transparent px-2 text-base sm:min-h-8 sm:text-sm" value={method} onChange={(event) => setMethod(event.target.value as PaymentMethod)}><option value={PaymentMethod.UPI}>UPI</option><option value={PaymentMethod.CASH}>Cash</option><option value={PaymentMethod.BANK_TRANSFER}>Bank transfer</option><option value={PaymentMethod.CARD}>Card</option></select></label>
            <label htmlFor="payment-status" className="grid gap-1.5 text-sm font-medium">Status<select id="payment-status" className="min-h-11 rounded-lg border border-input bg-transparent px-2 text-base sm:min-h-8 sm:text-sm" value={status} onChange={(event) => setStatus(event.target.value as PaymentStatus)}><option value={PaymentStatus.PAID}>Paid</option><option value={PaymentStatus.PARTIAL}>Partial</option><option value={PaymentStatus.PENDING}>Pending</option></select></label>
            <label htmlFor="payment-billing" className="grid gap-1.5 text-sm font-medium">Billing<select id="payment-billing" className="min-h-11 rounded-lg border border-input bg-transparent px-2 text-base sm:min-h-8 sm:text-sm" value={billingPeriod} onChange={(event) => setBillingPeriod(event.target.value as BillingPeriod)}><option value={BillingPeriod.MONTHLY}>Monthly</option><option value={BillingPeriod.CLASSWISE}>Class-wise</option></select></label>
          </div>
          {billingPeriod === BillingPeriod.MONTHLY ? (
            <div className="rounded-2xl border border-primary/15 bg-primary/5 p-4"><label htmlFor="payment-covered-month" className="grid gap-1.5 text-sm font-medium">Month covered by this payment<Input id="payment-covered-month" required type="month" value={coveredMonth} onChange={(event) => setCoveredMonth(event.target.value)} /></label><p className="mt-1.5 text-xs text-muted-foreground">The payment date is when money was received; this month is the tuition period it settles.</p></div>
          ) : (
            <div className="rounded-2xl border border-primary/15 bg-primary/5 p-4"><p className="text-sm font-medium">Classes covered by this payment</p><div className="mt-3 grid gap-3 sm:grid-cols-3"><label htmlFor="payment-from" className="grid gap-1.5 text-xs font-medium">From<Input id="payment-from" required type="date" value={coveredFromDate} onChange={(event) => setCoveredFromDate(event.target.value)} /></label><label htmlFor="payment-to" className="grid gap-1.5 text-xs font-medium">To<Input id="payment-to" required type="date" value={coveredToDate} onChange={(event) => setCoveredToDate(event.target.value)} /></label><label htmlFor="payment-class-count" className="grid gap-1.5 text-xs font-medium">Number of classes<Input id="payment-class-count" min={1} required type="number" value={coveredClassCount} onChange={(event) => setCoveredClassCount(event.target.value)} /></label></div><p className="mt-2 text-xs text-muted-foreground">The exact attended sessions can be allocated separately; these fields record the agreed coverage window and class count.</p></div>
          )}
          {coverageError && <p className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{coverageError}</p>}
          <label htmlFor="payment-notes" className="grid gap-1.5 text-sm font-medium">Notes<textarea id="payment-notes" className="min-h-20 rounded-lg border border-input bg-transparent p-2 text-base outline-none focus-visible:ring-3 focus-visible:ring-ring/50 sm:text-sm" value={notes} onChange={(event) => setNotes(event.target.value)} /></label>
          <DialogFooter className="-mx-4 -mb-4 sticky bottom-0 bg-surface/95 pt-3 backdrop-blur"><Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button><Button disabled={saving} type="submit">{saving ? "Saving…" : "Record payment"}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
