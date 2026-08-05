import { CalendarDays, Clock3 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AttendanceStatus, type Attendance } from "@/types/attendance";

interface AttendanceTimelineProps {
  records: readonly Attendance[];
}

const statusLabels: Record<AttendanceStatus, string> = {
  [AttendanceStatus.PRESENT]: "Present",
  [AttendanceStatus.ABSENT]: "Absent",
  [AttendanceStatus.CANCELLED]: "Cancelled",
  [AttendanceStatus.RESCHEDULED]: "Rescheduled",
};

const statusStyles: Record<AttendanceStatus, string> = {
  [AttendanceStatus.PRESENT]:
    "border-success/20 bg-success/10 text-success",
  [AttendanceStatus.ABSENT]:
    "border-destructive/20 bg-destructive/10 text-destructive",
  [AttendanceStatus.CANCELLED]:
    "border-border bg-muted text-muted-foreground",
  [AttendanceStatus.RESCHEDULED]:
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

export default function AttendanceTimeline({
  records,
}: Readonly<AttendanceTimelineProps>) {
  return (
    <Card className="border-border-strong bg-surface text-foreground shadow-card">
      <CardHeader className="border-b border-border/50 pb-4">
        <CardTitle className="text-lg text-foreground">Attendance history</CardTitle>
      </CardHeader>
      <CardContent className="pt-5">
        {records.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No attendance records yet.
          </p>
        ) : (
          <ol className="relative ml-2 border-l border-border-strong">
            {records.map((record) => (
              <li className="relative pb-6 pl-6 last:pb-0" key={record.id}>
                <span className="absolute top-1 -left-1.5 size-3 rounded-full border-2 border-surface bg-primary" />
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                      <CalendarDays className="size-4 text-primary" />
                      {formatDate(record.date)}
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                      <Clock3 className="size-3.5" />
                      {record.startTime} – {record.endTime}
                    </div>
                  </div>
                  <Badge className={statusStyles[record.status]} variant="outline">
                    {statusLabels[record.status]}
                  </Badge>
                </div>
                {record.notes && (
                  <p className="mt-2 text-sm leading-5 text-muted-foreground">
                    {record.notes}
                  </p>
                )}
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
