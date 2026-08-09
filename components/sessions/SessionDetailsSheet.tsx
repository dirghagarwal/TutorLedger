"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { addSessionAttachment, addSessionNote } from "@/app/actions/sessions";
import { recordAttendance, recordPayment } from "@/app/actions/workflow";
import PaymentDialog, { type PaymentDraft } from "@/components/workspace/PaymentDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useToast } from "@/components/ui/toast";
import { formatTime } from "@/lib/services/schedule";
import { AttendanceStatus, type Attendance } from "@/types/attendance";
import { AttachmentType, type Attachment } from "@/types/attachment";
import { type Payment } from "@/types/payment";
import { SessionStatus, type Session } from "@/types/session";
import type { SessionNote } from "@/types/session-note";

export interface SessionDetailsRecord {
  session: Session;
  studentName: string;
  studentColor: string;
  attendance: Attendance | null;
  payments: Payment[];
  notes: SessionNote[];
  attachments: Attachment[];
}

interface SessionDetailsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  record: SessionDetailsRecord | null;
}

function toLabel(value: string): string {
  return value.replaceAll("_", " ");
}

function formatClock(timestamp?: string | null): string | null {
  if (!timestamp) return null;
  return new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit" }).format(new Date(timestamp));
}

function uploadTypeFromAttachment(kind: AttachmentType): string {
  return kind;
}

function fileTypeFromName(name: string): AttachmentType {
  const lower = name.toLowerCase();
  if (lower.endsWith(".pdf")) return AttachmentType.PDF;
  return AttachmentType.FILE;
}

export default function SessionDetailsSheet({ open, onOpenChange, record }: Readonly<SessionDetailsSheetProps>) {
  const [isPending, startTransition] = useTransition();
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [note, setNote] = useState({ topic: "", classwork: "", homework: "", remarks: "" });
  const imageCaptureRef = useRef<HTMLInputElement>(null);
  const imageUploadRef = useRef<HTMLInputElement>(null);
  const fileUploadRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const router = useRouter();

  const currentRecordId = record?.session.id;
  const latestNote = record?.notes[0];

  useEffect(() => {
    if (latestNote) {
      setNote({
        topic: latestNote.topic,
        classwork: latestNote.classwork,
        homework: latestNote.homework,
        remarks: latestNote.remarks,
      });
    } else {
      setNote({ topic: "", classwork: "", homework: "", remarks: "" });
    }
  }, [currentRecordId, latestNote]);

  const currentAttendance = record?.attendance?.status ?? record?.session.status;
  const paymentHistory = useMemo(() => record?.payments ?? [], [record?.payments]);

  if (!record) return null;
  const currentRecord = record;

  async function submitAttendance(status: AttendanceStatus) {
    const payload = { sessionId: currentRecord.session.id, date: currentRecord.session.date, startTime: currentRecord.session.startTime, endTime: currentRecord.session.endTime, status, notes: "" };
    startTransition(async () => {
      const result = await recordAttendance(payload);
      if (!result.ok) toast({ title: "Attendance failed", description: result.error, variant: "error" });
      else { toast({ title: "Attendance recorded", variant: "success" }); router.refresh(); }
    });
  }

  async function saveNote() {
    startTransition(async () => {
      const payload = {
        sessionId: currentRecord.session.id,
        studentId: currentRecord.session.studentId,
        scheduleId: currentRecord.session.scheduleId,
        date: currentRecord.session.date,
        startTime: currentRecord.session.startTime,
        endTime: currentRecord.session.endTime,
        ...note,
      };
      const result = await addSessionNote(payload);
      if (!result.ok) toast({ title: "Note failed", description: result.error, variant: "error" });
      else { toast({ title: "Session record saved", variant: "success" }); router.refresh(); }
    });
  }

  async function uploadAttachment(file: File, attachmentType: AttachmentType) {
    const formData = new FormData();
    formData.set("sessionId", currentRecord.session.id);
    formData.set("studentId", currentRecord.session.studentId);
    formData.set("scheduleId", currentRecord.session.scheduleId);
    formData.set("date", currentRecord.session.date);
    formData.set("startTime", currentRecord.session.startTime);
    formData.set("endTime", currentRecord.session.endTime);
    formData.set("type", uploadTypeFromAttachment(attachmentType));
    formData.set("file", file);
    startTransition(async () => {
      const result = await addSessionAttachment(formData);
      if (!result.ok) toast({ title: "Upload failed", description: result.error, variant: "error" });
      else { toast({ title: "Attachment saved", variant: "success" }); router.refresh(); }
    });
  }

  async function handlePaymentSubmit(draft: PaymentDraft): Promise<boolean> {
    const payload = {
      studentId: currentRecord.session.studentId,
      sessionId: currentRecord.session.id,
      amount: draft.amount,
      date: new Date().toISOString().slice(0, 10),
      method: draft.method,
      status: draft.status,
      billingPeriod: draft.billingPeriod,
      notes: draft.notes,
    };
    const result = await recordPayment(payload);
    if (!result.ok) {
      toast({ title: "Payment failed", description: result.error, variant: "error" });
      return false;
    }
    toast({ title: "Payment recorded", variant: "success" });
    router.refresh();
    return true;
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[90dvh] overflow-y-auto rounded-t-3xl border-border-strong bg-surface p-0">
        <div className="mx-auto w-full max-w-4xl px-4 pb-8 pt-4 sm:px-6">
          <SheetHeader className="px-0 pb-4">
            <SheetTitle className="flex items-center gap-3 text-foreground">
              <span className="flex size-10 items-center justify-center rounded-2xl text-sm font-semibold text-foreground" style={{ backgroundColor: record.studentColor }}>
                {record.studentName.split(/\s+/).slice(0, 2).map((part) => part[0] ?? "").join("").toUpperCase()}
              </span>
              <span>
                {record.studentName}
                <span className="mt-1 block text-sm font-normal text-muted-foreground">
                  {formatTime(record.session.startTime)} – {formatTime(record.session.endTime)}
                  {record.session.startedAt ? ` · Started ${formatClock(record.session.startedAt)}` : ""}
                  {record.session.durationMinutes ? ` · ${record.session.durationMinutes} min` : ""}
                </span>
              </span>
            </SheetTitle>
            <SheetDescription>
              Session details, teaching record, attachments, and payment history.
            </SheetDescription>
          </SheetHeader>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
            <div className="grid gap-5">
              <section className="rounded-2xl border border-border-strong bg-muted/40 p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold text-foreground">Attendance</h3>
                  <Badge variant="outline">{currentAttendance ?? SessionStatus.PLANNED}</Badge>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <Button variant={record.attendance?.status === AttendanceStatus.PRESENT ? "default" : "outline"} onClick={() => void submitAttendance(AttendanceStatus.PRESENT)}>Present</Button>
                  <Button variant={record.attendance?.status === AttendanceStatus.ABSENT ? "destructive" : "outline"} onClick={() => void submitAttendance(AttendanceStatus.ABSENT)}>Absent</Button>
                  <Button variant="outline" onClick={() => void submitAttendance(AttendanceStatus.CANCELLED)}>Cancelled</Button>
                  <Button variant="outline" onClick={() => void submitAttendance(AttendanceStatus.RESCHEDULED)}>Rescheduled</Button>
                </div>
              </section>

              <section className="rounded-2xl border border-border-strong bg-muted/40 p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold text-foreground">Teaching Record</h3>
                  <Button variant="secondary" onClick={() => void saveNote()} disabled={isPending}>Save note</Button>
                </div>
                <div className="grid gap-3">
                  <Input value={note.topic} placeholder="Topic covered" onChange={(event) => setNote((current) => ({ ...current, topic: event.target.value }))} />
                  <textarea className="min-h-24 w-full rounded-lg border border-input bg-transparent p-3 text-sm outline-none placeholder:text-muted-foreground focus:border-ring focus:ring-3 focus:ring-ring/50" placeholder="Classwork done" value={note.classwork} onChange={(event) => setNote((current) => ({ ...current, classwork: event.target.value }))} />
                  <textarea className="min-h-24 w-full rounded-lg border border-input bg-transparent p-3 text-sm outline-none placeholder:text-muted-foreground focus:border-ring focus:ring-3 focus:ring-ring/50" placeholder="Homework given" value={note.homework} onChange={(event) => setNote((current) => ({ ...current, homework: event.target.value }))} />
                  <textarea className="min-h-24 w-full rounded-lg border border-input bg-transparent p-3 text-sm outline-none placeholder:text-muted-foreground focus:border-ring focus:ring-3 focus:ring-ring/50" placeholder="Private remarks" value={note.remarks} onChange={(event) => setNote((current) => ({ ...current, remarks: event.target.value }))} />
                </div>
              </section>

              <section className="rounded-2xl border border-border-strong bg-muted/40 p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold text-foreground">Attachments</h3>
                  <span className="text-xs text-muted-foreground">Multiple files per session</span>
                </div>
                <div className="grid gap-2 sm:grid-cols-3">
                  <Button variant="outline" onClick={() => imageCaptureRef.current?.click()}>Capture image</Button>
                  <Button variant="outline" onClick={() => imageUploadRef.current?.click()}>Upload image</Button>
                  <Button variant="outline" onClick={() => fileUploadRef.current?.click()}>Upload PDF / worksheet</Button>
                </div>
                <input ref={imageCaptureRef} className="hidden" accept="image/*" capture="environment" multiple type="file" onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void uploadAttachment(file, AttachmentType.IMAGE);
                  event.target.value = "";
                }} />
                <input ref={imageUploadRef} className="hidden" accept="image/*" multiple type="file" onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void uploadAttachment(file, AttachmentType.IMAGE);
                  event.target.value = "";
                }} />
                <input ref={fileUploadRef} className="hidden" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,*/*" multiple type="file" onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void uploadAttachment(file, fileTypeFromName(file.name));
                  event.target.value = "";
                }} />

                <div className="mt-4 grid gap-2">
                  {record.attachments.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No attachments yet.</p>
                  ) : record.attachments.map((attachment) => (
                    <a className="flex items-center justify-between rounded-xl border border-border/50 bg-surface px-3 py-2 text-sm text-foreground hover:bg-primary/5" href={attachment.storagePath} key={attachment.id} download={attachment.filename}>
                      <span>{attachment.filename}</span>
                      <Badge variant="outline">{attachment.type}</Badge>
                    </a>
                  ))}
                </div>
              </section>
            </div>

            <div className="grid gap-5">
              <section className="rounded-2xl border border-border-strong bg-muted/40 p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold text-foreground">Payments</h3>
                  <Button variant="secondary" onClick={() => setPaymentOpen(true)}>Record payment</Button>
                </div>
                <div className="grid gap-3">
                  {paymentHistory.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No payments recorded for this session.</p>
                  ) : paymentHistory.map((payment) => (
                    <div className="rounded-xl border border-border/50 bg-surface p-3" key={payment.id}>
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-medium text-foreground">₹{payment.amount.toLocaleString("en-IN")}</p>
                        <Badge variant="outline">{toLabel(payment.status)}</Badge>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{payment.date} · {toLabel(payment.method)} · {toLabel(payment.billingPeriod)}</p>
                    </div>
                  ))}
                </div>
              </section>

              <section className="rounded-2xl border border-border-strong bg-muted/40 p-4">
                <h3 className="mb-3 text-sm font-semibold text-foreground">Session Notes</h3>
                <div className="grid gap-3">
                  {record.notes.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No session notes yet.</p>
                  ) : record.notes.map((sessionNote) => (
                    <article className="rounded-xl border border-border/50 bg-surface p-3" key={sessionNote.id}>
                      <p className="font-medium text-foreground">{sessionNote.topic}</p>
                      <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{sessionNote.classwork}</p>
                      <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">Homework: {sessionNote.homework}</p>
                      <p className="mt-2 whitespace-pre-wrap text-sm text-secondary-foreground">Remarks: {sessionNote.remarks}</p>
                      <p className="mt-2 text-xs text-muted-foreground">Updated {sessionNote.updatedAt}</p>
                    </article>
                  ))}
                </div>
              </section>
            </div>
          </div>
        </div>

        {paymentOpen && <PaymentDialog open={paymentOpen} studentName={record.studentName} onOpenChange={(open) => setPaymentOpen(open)} onSubmit={handlePaymentSubmit} />}
      </SheetContent>
    </Sheet>
  );
}