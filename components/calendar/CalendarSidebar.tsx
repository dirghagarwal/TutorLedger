import { CalendarClock, CheckCircle2, CircleDollarSign, XCircle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatTime } from "@/lib/services/schedule";
import { groupSessionsByStatus } from "@/lib/services/sessions";
import type { Attendance } from "@/types/attendance";
import type { Session } from "@/types/session";
import type { CalendarStudent } from "@/components/calendar/CalendarDay";

interface CalendarSidebarProps {
  attendanceBySession: Readonly<Record<string, Attendance | undefined>>;
  date: string;
  sessions: readonly Session[];
  studentsById: Readonly<Record<string, CalendarStudent>>;
  onClose: () => void;
  onSelectSession: (session: Session) => void;
}

export default function CalendarSidebar({
  attendanceBySession,
  date,
  sessions,
  studentsById,
  onClose,
  onSelectSession,
}: Readonly<CalendarSidebarProps>) {
  const groups = groupSessionsByStatus(sessions);

  return (
    <aside className="border-t border-border-strong bg-sidebar p-5 xl:border-l xl:border-t-0">
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">Selected day</p>
          <h2 className="mt-1 text-xl font-semibold text-foreground">{date}</h2>
        </div>
        <Button className="text-muted-foreground hover:bg-muted hover:text-foreground" size="icon-sm" type="button" variant="ghost" onClick={onClose}>
          <XCircle />
          <span className="sr-only">Close day details</span>
        </Button>
      </div>

      <SessionSection icon={<CalendarClock />} label="Upcoming sessions" sessions={groups.upcoming} studentsById={studentsById} attendanceBySession={attendanceBySession} onSelectSession={onSelectSession} />
      <SessionSection icon={<CheckCircle2 />} label="Completed sessions" sessions={groups.completed} studentsById={studentsById} attendanceBySession={attendanceBySession} onSelectSession={onSelectSession} />
      <SessionSection icon={<XCircle />} label="Cancelled sessions" sessions={groups.cancelled} studentsById={studentsById} attendanceBySession={attendanceBySession} onSelectSession={onSelectSession} />

      <div className="mt-6 rounded-xl border border-dashed border-border-strong bg-surface-subtle p-4">
        <div className="flex items-center gap-2 text-sm font-medium text-secondary-foreground">
          <CircleDollarSign className="size-4 text-warning" />
          Payments
        </div>
        <p className="mt-2 text-xs leading-5 text-muted-foreground">
          Payment details will appear here when session-linked payments are introduced.
        </p>
      </div>
    </aside>
  );
}

function SessionSection({
  attendanceBySession,
  icon,
  label,
  sessions,
  studentsById,
  onSelectSession,
}: Readonly<{
  attendanceBySession: Readonly<Record<string, Attendance | undefined>>;
  icon: React.ReactNode;
  label: string;
  sessions: readonly Session[];
  studentsById: Readonly<Record<string, CalendarStudent>>;
  onSelectSession?: (session: Session) => void;
}>) {
  if (sessions.length === 0) return null;

  return (
    <section className="mb-5">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-medium text-secondary-foreground">
        {icon}
        {label}
      </h3>
      <div className="space-y-2">
        {sessions.map((session) => {
          const student = studentsById[session.studentId];
          const attendance = attendanceBySession[session.id];
          return (
            <button className="w-full rounded-xl border border-border/50 bg-muted p-3 text-left transition-colors hover:bg-primary/5" key={session.id} type="button" onClick={() => onSelectSession?.(session)}>
              <div className="flex items-center justify-between gap-3">
                <p className="truncate text-sm font-medium text-foreground">
                  {student?.name ?? "Student"}
                </p>
                <Badge className="border-border bg-muted text-secondary-foreground" variant="outline">
                  {session.status}
                </Badge>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {formatTime(session.startTime)} – {formatTime(session.endTime)}
              </p>
              <p className="mt-2 text-xs text-primary">
                Attendance: {attendance?.status ?? "Not recorded"}
              </p>
            </button>
          );
        })}
      </div>
    </section>
  );
}
