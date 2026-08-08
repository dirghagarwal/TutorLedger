"use client";

import { Check, CircleDollarSign, Clock3, Play, Square, WifiOff, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";

import { recordAttendance, recordPayment, updateClassStatus } from "@/app/actions/workflow";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import PaymentDialog, { type PaymentDraft } from "@/components/workspace/PaymentDialog";
import { useOfflineQueue, type OfflineQueueItem } from "@/components/workspace/useOfflineQueue";
import { useToast } from "@/components/ui/toast";
import { formatTime } from "@/lib/services/schedule";
import { getSessionStatusForAttendance } from "@/lib/services/workflow";
import { AttendanceStatus, type Attendance } from "@/types/attendance";
import { type Payment } from "@/types/payment";
import { SessionStatus, type Session } from "@/types/session";

export interface TodayClassItem {
  session: Session;
  studentName: string;
  studentColor: string;
  attendance: Attendance | null;
  payments: Payment[];
}

function getInitials(name: string) { return name.split(/\s+/).filter((part) => part !== "&").slice(0, 2).map((part) => part[0] ?? "").join("").toUpperCase(); }
function today() { return new Date().toISOString().slice(0, 10); }

export default function TodayClasses({ initialItems }: Readonly<{ initialItems: TodayClassItem[] }>) {
  const [items, setItems] = useState(initialItems);
  const [startedSessionIds, setStartedSessionIds] = useState<Set<string>>(() => new Set());
  const [paymentFor, setPaymentFor] = useState<TodayClassItem | null>(null);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();
  const router = useRouter();

  const processQueuedItem = async (item: OfflineQueueItem) => {
    const result = item.kind === "attendance" ? await recordAttendance(item.payload) : await recordPayment(item.payload);
    if (result.ok) {
      toast({ title: "Offline update synced", variant: "success" });
      router.refresh();
      return true;
    }
    return false;
  };
  const { enqueue, queuedCount } = useOfflineQueue(processQueuedItem);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLSelectElement) return;
      const first = items[0];
      if (!first) return;
      if (event.key.toLowerCase() === "p") { event.preventDefault(); void setAttendance(first, AttendanceStatus.PRESENT); }
      if (event.key.toLowerCase() === "a") { event.preventDefault(); void setAttendance(first, AttendanceStatus.ABSENT); }
      if (event.key.toLowerCase() === "s") { event.preventDefault(); startClass(first); }
      if (event.key.toLowerCase() === "e") { event.preventDefault(); void updateStatus(first, SessionStatus.COMPLETED, "Class ended"); }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  const setLocalAttendance = (sessionId: string, attendance: Attendance, status: SessionStatus) =>
    setItems((current) =>
      current.map((item) => (item.session.id === sessionId ? { ...item, attendance, session: { ...item.session, status } } : item))
    );

  async function setAttendance(item: TodayClassItem, status: AttendanceStatus) {
    const previous = item;
    const attendance: Attendance = {
      id: `attendance-${item.session.id}`,
      sessionId: item.session.id,
      date: item.session.date,
      startTime: item.session.startTime,
      endTime: item.session.endTime,
      status,
      notes: "",
    };
    const nextStatus = getSessionStatusForAttendance(status);
    setLocalAttendance(item.session.id, attendance, nextStatus);
    const payload = {
      sessionId: item.session.id,
      studentId: item.session.studentId,
      scheduleId: item.session.scheduleId,
      date: item.session.date,
      startTime: item.session.startTime,
      endTime: item.session.endTime,
      status,
      notes: "",
    };
    if (!navigator.onLine) {
      enqueue({ kind: "attendance", payload });
      toast({ title: "Attendance queued", description: "It will sync when you are online.", variant: "info" });
      return;
    }
    startTransition(async () => {
      const result = await recordAttendance(payload);
      if (!result.ok) {
        setItems((current) => current.map((currentItem) => (currentItem.session.id === item.session.id ? previous : currentItem)));
        toast({ title: "Attendance failed", description: result.error, variant: "error" });
      } else {
        toast({ title: "Attendance recorded", variant: "success" });
        router.refresh();
      }
    });
  }

  async function updateStatus(
    item: TodayClassItem,
    status: SessionStatus,
    message: string,
    extra: { startedAt?: string; endedAt?: string } = {}
  ) {
    const previous = item.session;
    const nowIso = new Date().toISOString();
    const startedAt = extra.startedAt ?? (status === SessionStatus.IN_PROGRESS ? nowIso : item.session.startedAt ?? undefined);
    const endedAt = extra.endedAt ?? (status === SessionStatus.COMPLETED ? nowIso : item.session.endedAt ?? undefined);

    setItems((current) =>
      current.map((currentItem) =>
        currentItem.session.id === item.session.id
          ? {
              ...currentItem,
              session: {
                ...currentItem.session,
                status,
                startedAt: startedAt ?? currentItem.session.startedAt,
                endedAt: endedAt ?? currentItem.session.endedAt,
              },
            }
          : currentItem
      )
    );

    startTransition(async () => {
      const payload = {
        sessionId: item.session.id,
        studentId: item.session.studentId,
        scheduleId: item.session.scheduleId,
        date: item.session.date,
        startTime: item.session.startTime,
        endTime: item.session.endTime,
        status,
        startedAt,
        endedAt,
      };
      const result = await updateClassStatus(payload);
      if (!result.ok) {
        setItems((current) => current.map((currentItem) => (currentItem.session.id === item.session.id ? { ...currentItem, session: previous } : currentItem)));
        if (status === SessionStatus.IN_PROGRESS) {
          setStartedSessionIds((current) => {
            const next = new Set(current);
            next.delete(item.session.id);
            return next;
          });
        }
        toast({ title: "Class update failed", description: result.error, variant: "error" });
      } else {
        toast({
          title: message,
          description: result.warning,
          variant: result.warning ? "info" : "success",
        });
        router.refresh();
      }
    });
  }

  function startClass(item: TodayClassItem) {
    setStartedSessionIds((current) => new Set(current).add(item.session.id));
    void updateStatus(item, SessionStatus.IN_PROGRESS, "Class started", { startedAt: new Date().toISOString() });
  }

  async function submitPayment(draft: PaymentDraft): Promise<boolean> {
    if (!paymentFor) return false;
    const payload = {
      studentId: paymentFor.session.studentId,
      sessionId: paymentFor.session.id,
      amount: draft.amount,
      date: today(),
      method: draft.method,
      status: draft.status,
      billingPeriod: draft.billingPeriod,
      notes: draft.notes,
    };
    const optimistic: Payment = { id: `offline-${Date.now()}`, ...payload };
    setItems((current) =>
      current.map((item) => (item.session.id === paymentFor.session.id ? { ...item, payments: [optimistic, ...item.payments] } : item))
    );
    if (!navigator.onLine) {
      enqueue({ kind: "payment", payload });
      toast({ title: "Payment queued", description: "It will sync when you are online.", variant: "info" });
      return true;
    }
    const result = await recordPayment(payload);
    if (!result.ok) {
      setItems((current) =>
        current.map((item) =>
          item.session.id === paymentFor.session?.id
            ? { ...item, payments: item.payments.filter((payment) => payment.id !== optimistic.id) }
            : item
        )
      );
      toast({ title: "Payment failed", description: result.error, variant: "error" });
      return false;
    }
    toast({ title: "Payment recorded", variant: "success" });
    router.refresh();
    return true;
  }
  const sortedItems = useMemo(() => [...items].sort((a, b) => a.session.startTime.localeCompare(b.session.startTime)), [items]);

  return (
    <section aria-labelledby="today-classes-heading" className="mt-8">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-medium tracking-[0.2em] text-primary uppercase">Daily workflow</p>
          <h2 className="mt-1 text-2xl font-semibold text-foreground" id="today-classes-heading">
            Today&apos;s classes
          </h2>
          <p className="mt-1 hidden text-xs text-muted-foreground sm:block">Keyboard: P present · A absent · S start · E end</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {queuedCount > 0 && (
            <>
              <WifiOff className="size-4" /> {queuedCount} queued
            </>
          )}
          {isPending && "Saving…"}
        </div>
      </div>
      {sortedItems.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">No classes scheduled for today.</CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {sortedItems.map((item) => (
            <TodayClassCard
              disabled={isPending}
              item={item}
              key={item.session.id}
              started={startedSessionIds.has(item.session.id) || item.session.status === SessionStatus.IN_PROGRESS}
              onAttendance={(status) => void setAttendance(item, status)}
              onEnd={() => {
                setStartedSessionIds((current) => {
                  const next = new Set(current);
                  next.delete(item.session.id);
                  return next;
                });
                void updateStatus(item, SessionStatus.COMPLETED, "Class ended", { endedAt: new Date().toISOString() });
              }}
              onPayment={() => setPaymentFor(item)}
              onStart={() => startClass(item)}
            />
          ))}
        </div>
      )}
      {paymentFor && (
        <PaymentDialog
          open={Boolean(paymentFor)}
          studentName={paymentFor.studentName}
          onOpenChange={(open) => {
            if (!open) setPaymentFor(null);
          }}
          onSubmit={submitPayment}
        />
      )}
    </section>
  );
}

function TodayClassCard({
  disabled,
  item,
  onAttendance,
  onEnd,
  onPayment,
  onStart,
  started,
}: Readonly<{
  disabled?: boolean;
  item: TodayClassItem;
  onAttendance: (status: AttendanceStatus) => void;
  onEnd: () => void;
  onPayment: () => void;
  onStart: () => void;
  started: boolean;
}>) {
  const currentAttendance = item.attendance?.status;
  const statusLabel = currentAttendance ?? item.session.status;
  return (
    <Card className="border-border-strong bg-surface shadow-card">
      <CardHeader className="flex-row items-start justify-between gap-3 border-b border-border/50 pb-4">
        <div className="flex min-w-0 items-center gap-3">
          <div
            aria-hidden="true"
            className="flex size-11 shrink-0 items-center justify-center rounded-full text-sm font-bold text-foreground"
            style={{ backgroundColor: item.studentColor }}
          >
            {getInitials(item.studentName)}
          </div>
          <div className="min-w-0">
            <CardTitle className="truncate text-base sm:text-lg">{item.studentName}</CardTitle>
            <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
              <Clock3 className="size-4" />
              {formatTime(item.session.startTime)} – {formatTime(item.session.endTime)}
            </p>
          </div>
        </div>
        <Badge variant="outline">{started ? "IN PROGRESS" : statusLabel}</Badge>
      </CardHeader>
      <CardContent className="grid gap-3 p-4">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Button
            aria-pressed={currentAttendance === AttendanceStatus.PRESENT}
            className="min-h-11 touch-manipulation"
            disabled={disabled}
            variant={currentAttendance === AttendanceStatus.PRESENT ? "default" : "outline"}
            onClick={() => onAttendance(AttendanceStatus.PRESENT)}
          >
            <Check /> Present
          </Button>
          <Button
            aria-pressed={currentAttendance === AttendanceStatus.ABSENT}
            className="min-h-11 touch-manipulation"
            disabled={disabled}
            variant={currentAttendance === AttendanceStatus.ABSENT ? "destructive" : "outline"}
            onClick={() => onAttendance(AttendanceStatus.ABSENT)}
          >
            <X /> Absent
          </Button>
          <Button
            aria-pressed={currentAttendance === AttendanceStatus.CANCELLED}
            className="min-h-11 touch-manipulation"
            disabled={disabled}
            variant="outline"
            onClick={() => onAttendance(AttendanceStatus.CANCELLED)}
          >
            Cancelled
          </Button>
          <Button
            aria-pressed={currentAttendance === AttendanceStatus.RESCHEDULED}
            className="min-h-11 touch-manipulation"
            disabled={disabled}
            variant="outline"
            onClick={() => onAttendance(AttendanceStatus.RESCHEDULED)}
          >
            Reschedule
          </Button>
        </div>
        <div className="flex flex-wrap gap-2 border-t border-border/50 pt-3">
          <Button className="min-h-11 flex-1 touch-manipulation" disabled={disabled || started} variant="secondary" onClick={onStart}>
            <Play /> {started ? "Started" : "Start class"}
          </Button>
          <Button className="min-h-11 flex-1 touch-manipulation" disabled={disabled} variant="secondary" onClick={onEnd}>
            <Square /> End class
          </Button>
          <Button className="min-h-11 flex-1 touch-manipulation" disabled={disabled} variant="outline" onClick={onPayment}>
            <CircleDollarSign /> Payment
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
