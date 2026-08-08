import { CalendarDays, Clock3, Paperclip, ReceiptText } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatTime } from "@/lib/services/schedule";
import { type Attendance } from "@/types/attendance";
import { type Attachment } from "@/types/attachment";
import { type Payment } from "@/types/payment";
import { SessionStatus, type Session } from "@/types/session";
import type { SessionNote } from "@/types/session-note";

interface SessionTimelineProps {
  attendanceBySession: Readonly<Record<string, Attendance | undefined>>;
  attachmentsBySession: Readonly<Record<string, Attachment[] | undefined>>;
  notesBySession: Readonly<Record<string, SessionNote[] | undefined>>;
  paymentsBySession: Readonly<Record<string, Payment[] | undefined>>;
  sessions: readonly Session[];
}

const statusStyles: Record<SessionStatus, string> = {
  [SessionStatus.PLANNED]: "border-primary/20 bg-primary/10 text-primary",
  [SessionStatus.IN_PROGRESS]: "border-info/20 bg-info/10 text-info",
  [SessionStatus.COMPLETED]:
    "border-success/20 bg-success/10 text-success",
  [SessionStatus.CANCELLED]:
    "border-border bg-muted text-muted-foreground",
  [SessionStatus.RESCHEDULED]:
    "border-warning/20 bg-warning/10 text-warning",
};

function formatDate(date: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(`${date}T00:00:00`));
}

export default function SessionTimeline({
  attendanceBySession,
  attachmentsBySession,
  notesBySession,
  paymentsBySession,
  sessions,
}: Readonly<SessionTimelineProps>) {
  return (
    <Card className="border-border-strong bg-surface text-foreground shadow-card">
      <CardHeader className="border-b border-border/50 pb-4">
        <CardTitle className="text-lg text-foreground">Session history</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3 pt-5">
        {sessions.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border-strong p-4 text-sm text-muted-foreground">
            No sessions in this period.
          </p>
        ) : (
          sessions.map((session) => (
            <SessionRow
              attendance={attendanceBySession[session.id]}
              attachments={attachmentsBySession[session.id] ?? []}
              key={session.id}
              notes={notesBySession[session.id] ?? []}
              payments={paymentsBySession[session.id] ?? []}
              session={session}
            />
          ))
        )}
      </CardContent>
    </Card>
  );
}

function SessionRow({
  attendance,
  attachments,
  notes,
  payments,
  session,
}: Readonly<{
  attendance?: Attendance;
  attachments: readonly Attachment[];
  notes: readonly SessionNote[];
  payments: readonly Payment[];
  session: Session;
}>) {
  const latestNote = notes[0];
  return (
    <article className="rounded-xl border border-border/50 bg-muted p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-sm font-medium text-foreground">
            <CalendarDays className="size-4 text-primary" />
            {formatDate(session.date)}
          </p>
          <p className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
            <Clock3 className="size-3.5" />
            {formatTime(session.startTime)} – {formatTime(session.endTime)}
          </p>
        </div>
        <Badge className={statusStyles[session.status]} variant="outline">{session.status}</Badge>
      </div>
      <div className="mt-4 grid gap-3 text-sm">
        <div className="rounded-lg bg-surface p-3 text-muted-foreground">
          Attendance: {attendance?.status ?? "Not recorded"}
        </div>
        {latestNote ? (
          <div className="rounded-lg bg-surface p-3">
            <p className="font-medium text-foreground">{latestNote.topic}</p>
            <p className="mt-1 whitespace-pre-wrap text-xs text-muted-foreground">{latestNote.classwork}</p>
            <p className="mt-1 whitespace-pre-wrap text-xs text-muted-foreground">Homework: {latestNote.homework}</p>
            <p className="mt-1 whitespace-pre-wrap text-xs text-secondary-foreground">Remarks: {latestNote.remarks}</p>
          </div>
        ) : null}
        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1 rounded-full border border-border/50 bg-surface px-2 py-1"><Paperclip className="size-3" /> {attachments.length} attachments</span>
          <span className="inline-flex items-center gap-1 rounded-full border border-border/50 bg-surface px-2 py-1"><ReceiptText className="size-3" /> {payments.length} payments</span>
        </div>
      </div>
    </article>
  );
}
