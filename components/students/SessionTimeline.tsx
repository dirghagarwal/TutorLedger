import { CalendarDays, Clock3 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatTime } from "@/lib/services/schedule";
import { SessionStatus, type Session } from "@/types/session";

interface SessionTimelineProps {
  pastSessions: readonly Session[];
  upcomingSessions: readonly Session[];
}

const statusStyles: Record<SessionStatus, string> = {
  [SessionStatus.PLANNED]: "border-primary/20 bg-primary/10 text-primary",
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
  pastSessions,
  upcomingSessions,
}: Readonly<SessionTimelineProps>) {
  return (
    <Card className="border-border-strong bg-surface text-foreground shadow-card">
      <CardHeader className="border-b border-border/50 pb-4">
        <CardTitle className="text-lg text-foreground">Sessions</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-6 pt-5">
        <SessionGroup label="Upcoming sessions" sessions={upcomingSessions} />
        <SessionGroup label="Past sessions" sessions={pastSessions} />
      </CardContent>
    </Card>
  );
}

function SessionGroup({
  label,
  sessions,
}: Readonly<{ label: string; sessions: readonly Session[] }>) {
  return (
    <section>
      <h3 className="mb-3 text-sm font-medium text-secondary-foreground">{label}</h3>
      {sessions.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border-strong p-4 text-sm text-muted-foreground">
          No sessions in this period.
        </p>
      ) : (
        <div className="space-y-3">
          {sessions.map((session) => (
            <div
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/50 bg-muted p-4"
              key={session.id}
            >
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
              <Badge className={statusStyles[session.status]} variant="outline">
                {session.status}
              </Badge>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
