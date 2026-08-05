import { CalendarDays, Clock3 } from "lucide-react";

import { formatTime } from "@/lib/services/schedule";
import type { Session } from "@/types/session";

export interface SessionView {
  session: Session;
  studentName: string;
}

interface RightPanelProps {
  todaySessions: readonly SessionView[];
  nextSession: SessionView | null;
}

export default function RightPanel({
  nextSession,
  todaySessions,
}: Readonly<RightPanelProps>) {
  return (
    <aside className="hidden w-80 shrink-0 border-l border-border bg-sidebar p-6 xl:block">
      <h2 className="mb-5 text-lg font-semibold text-foreground">Today&apos;s sessions</h2>

      <div className="space-y-3">
        {todaySessions.length === 0 ? (
          <p className="rounded-xl bg-muted p-4 text-sm text-muted-foreground">
            No sessions scheduled today.
          </p>
        ) : (
          todaySessions.map(({ session, studentName }) => (
            <div className="rounded-xl bg-muted p-4" key={session.id}>
              <p className="font-medium text-foreground">{studentName}</p>
              <p className="mt-1 text-sm text-muted-foreground">{session.startTime}</p>
              <p className="mt-2 flex items-center gap-2 text-sm text-primary">
                <Clock3 className="size-4" />
                {formatTime(session.startTime)} – {formatTime(session.endTime)}
              </p>
            </div>
          ))
        )}
      </div>

      <h2 className="mb-4 mt-8 text-lg font-semibold text-foreground">Next session</h2>
      {nextSession ? (
        <div className="rounded-xl border border-primary/10 bg-primary/5 p-4">
          <p className="font-medium text-foreground">{nextSession.studentName}</p>
          <p className="mt-1 text-sm text-muted-foreground">{nextSession.session.date}</p>
          <p className="mt-2 flex items-center gap-2 text-sm text-primary">
            <CalendarDays className="size-4" />
            {formatTime(nextSession.session.startTime)}
          </p>
        </div>
      ) : (
        <p className="rounded-xl bg-muted p-4 text-sm text-muted-foreground">
          No upcoming sessions.
        </p>
      )}
    </aside>
  );
}
