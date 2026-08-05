"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { BillingPeriod, PaymentMethod, PaymentStatus } from "@/types/payment";

export interface PaymentDraft {
  amount: number;
  method: PaymentMethod;
  status: PaymentStatus;
  billingPeriod: BillingPeriod;
  notes: string;
}

interface PaymentDialogProps {
  open: boolean;
  studentName: string;
  onOpenChange: (open: boolean) => void;
  onSubmit: (draft: PaymentDraft) => Promise<boolean>;
}

export default function PaymentDialog({ open, studentName, onOpenChange, onSubmit }: Readonly<PaymentDialogProps>) {
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<PaymentMethod>(PaymentMethod.UPI);
  const [status, setStatus] = useState<PaymentStatus>(PaymentStatus.PAID);
  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>(BillingPeriod.MONTHLY);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    const succeeded = await onSubmit({ amount: Number(amount), method, status, billingPeriod, notes });
    setSaving(false);
    if (!succeeded) return;
    setAmount("");
    setNotes("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%-1rem)] border-border-strong bg-surface text-foreground sm:max-w-lg">
        <DialogHeader><DialogTitle>Record payment</DialogTitle><DialogDescription>Record a payment from {studentName}.</DialogDescription></DialogHeader>
        <form className="grid gap-4" onSubmit={(event) => void submit(event)}>
          <label className="grid gap-1.5 text-sm font-medium">Amount<Input min={1} required type="number" value={amount} onChange={(event) => setAmount(event.target.value)} /></label>
          <div className="grid gap-4 sm:grid-cols-3">
            <label className="grid gap-1.5 text-sm font-medium">Method<select className="min-h-11 rounded-lg border border-input bg-transparent px-2 text-sm sm:min-h-8" value={method} onChange={(event) => setMethod(event.target.value as PaymentMethod)}><option value={PaymentMethod.UPI}>UPI</option><option value={PaymentMethod.CASH}>Cash</option><option value={PaymentMethod.BANK_TRANSFER}>Bank transfer</option><option value={PaymentMethod.CARD}>Card</option></select></label>
            <label className="grid gap-1.5 text-sm font-medium">Status<select className="min-h-11 rounded-lg border border-input bg-transparent px-2 text-sm sm:min-h-8" value={status} onChange={(event) => setStatus(event.target.value as PaymentStatus)}><option value={PaymentStatus.PAID}>Paid</option><option value={PaymentStatus.PARTIAL}>Partial</option><option value={PaymentStatus.PENDING}>Pending</option></select></label>
            <label className="grid gap-1.5 text-sm font-medium">Billing<select className="min-h-11 rounded-lg border border-input bg-transparent px-2 text-sm sm:min-h-8" value={billingPeriod} onChange={(event) => setBillingPeriod(event.target.value as BillingPeriod)}><option value={BillingPeriod.MONTHLY}>Monthly</option><option value={BillingPeriod.CLASSWISE}>Class-wise</option></select></label>
          </div>
          <label className="grid gap-1.5 text-sm font-medium">Notes<textarea className="min-h-20 rounded-lg border border-input bg-transparent p-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50" value={notes} onChange={(event) => setNotes(event.target.value)} /></label>
          <DialogFooter className="-mx-4 -mb-4"><Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button><Button disabled={saving} type="submit">{saving ? "Saving…" : "Record payment"}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
