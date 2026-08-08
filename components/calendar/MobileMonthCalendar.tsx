"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { formatTime } from "@/lib/services/schedule";
import type { MonthCalendarDay } from "@/lib/services/sessions";
import type { Session } from "@/types/session";
import type { CalendarStudent } from "@/components/calendar/CalendarDay";
import type { SessionDetailsRecord } from "@/components/sessions/SessionDetailsSheet";

interface MobileMonthCalendarProps {
  calendarDays: readonly MonthCalendarDay[];
  monthDate: string;
  monthLabel: string;
  sessionsByDate: Readonly<Record<string, Session[]>>;
  studentsById: Readonly<Record<string, CalendarStudent>>;
  today: string;
  sessionDetailsById: Readonly<Record<string, SessionDetailsRecord | undefined>>;
  onSelectSession: (record: SessionDetailsRecord) => void;
}

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function getInitials(name: string): string {
  return name.split(/\s+/).filter((part) => part !== "&").slice(0, 2).map((part) => part[0] ?? "").join("").toUpperCase();
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date: Date, delta: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + delta, 1);
}

export default function MobileMonthCalendar({
  calendarDays,
  monthDate,
  monthLabel,
  sessionDetailsById,
  sessionsByDate,
  studentsById,
  today,
  onSelectSession,
}: Readonly<MobileMonthCalendarProps>) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selectedDay, setSelectedDay] = useState<string | null>(today);
  const swipeStartX = useRef<number | null>(null);

  const selectedSessions = useMemo(() => (selectedDay ? sessionsByDate[selectedDay] ?? [] : []), [selectedDay, sessionsByDate]);
  const monthDateObject = useMemo(() => new Date(`${monthDate}T00:00:00`), [monthDate]);

  function goToMonth(nextDate: Date) {
    const next = new URLSearchParams(searchParams.toString());
    next.set("month", monthKey(nextDate));
    router.push(`?${next.toString()}`);
  }

  return (
    <div className="lg:hidden">
      <div className="mb-4 flex items-center justify-between gap-3 rounded-2xl border border-border-strong bg-surface p-4">
        <Button className="border-border bg-card text-secondary-foreground hover:bg-muted" size="icon-sm" variant="outline" onClick={() => goToMonth(addMonths(monthDateObject, -1))}>
          <ChevronLeft />
        </Button>
        <div className="text-center">
          <p className="text-xs font-medium tracking-[0.24em] text-primary uppercase">Calendar</p>
          <h1 className="text-lg font-semibold text-foreground">{monthLabel}</h1>
        </div>
        <Button className="border-border bg-card text-secondary-foreground hover:bg-muted" size="icon-sm" variant="outline" onClick={() => goToMonth(addMonths(monthDateObject, 1))}>
          <ChevronRight />
        </Button>
      </div>

      <Button className="mb-4 w-full" variant="secondary" onClick={() => goToMonth(startOfMonth(new Date()))}>Today</Button>

      <div
        className="overflow-hidden rounded-3xl border border-border-strong bg-surface shadow-card"
        onTouchEnd={(event) => {
          const startX = swipeStartX.current;
          swipeStartX.current = null;
          if (startX == null) return;
          const endX = event.changedTouches[0]?.clientX ?? startX;
          const delta = endX - startX;
          if (Math.abs(delta) < 60) return;
          goToMonth(addMonths(monthDateObject, delta > 0 ? -1 : 1));
        }}
        onTouchStart={(event) => {
          swipeStartX.current = event.touches[0]?.clientX ?? null;
        }}
      >
        <div className="grid grid-cols-7 border-b border-border/50 bg-surface-subtle/70 text-center text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => <div className="py-3" key={day}>{day}</div>)}
        </div>
        <div className="grid grid-cols-7">
          {calendarDays.map((calendarDay, index) => {
            const date = calendarDay.date;
            const sessions = date ? sessionsByDate[date] ?? [] : [];
            const hasSessions = sessions.length > 0;
            const isSelected = date === selectedDay;
            const isToday = date === today;
            return (
              <button
                className={`min-h-20 border-b border-r border-border/50 p-2 text-left transition-colors ${date ? "" : "bg-surface-subtle/50"} ${isSelected ? "bg-primary/10" : "bg-surface"} ${isToday ? "ring-1 ring-inset ring-primary/50" : ""}`}
                key={date ?? `empty-${index}`}
                type="button"
                onClick={() => date && setSelectedDay(date)}
              >
                {date && (
                  <>
                    <span className={`inline-flex size-7 items-center justify-center rounded-full text-xs font-semibold ${isToday ? "bg-primary text-primary-foreground" : "text-secondary-foreground"}`}>{calendarDay.day}</span>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {sessions.slice(0, 3).map((session) => {
                        const student = studentsById[session.studentId];
                        return (
                          <span
                            aria-label={student?.name ?? "Student"}
                            className="size-2.5 rounded-full"
                            key={session.id}
                            style={{ backgroundColor: student?.color ?? "var(--avatar-fallback)" }}
                          />
                        );
                      })}
                      {hasSessions && sessions.length > 3 && <span className="text-[10px] text-primary">+{sessions.length - 3}</span>}
                    </div>
                  </>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <Sheet open={Boolean(selectedDay)} onOpenChange={(open) => { if (!open) setSelectedDay(null); }}>
        <SheetContent side="bottom" className="h-[75dvh] overflow-y-auto rounded-t-3xl border-border-strong bg-surface p-0">
          <div className="px-4 pb-6 pt-4 sm:px-6">
            <SheetHeader className="px-0 pb-4">
              <SheetTitle>{selectedDay}</SheetTitle>
            </SheetHeader>
            <div className="grid gap-3">
              {selectedSessions.length === 0 ? (
                <p className="text-sm text-muted-foreground">No sessions on this day.</p>
              ) : selectedSessions.map((session) => {
                const student = studentsById[session.studentId];
                const detailRecord = sessionDetailsById[session.id];
                return (
                  <button className="flex w-full items-center gap-3 rounded-2xl border border-border/50 bg-muted p-3 text-left hover:bg-primary/5" key={session.id} type="button" onClick={() => detailRecord && onSelectSession(detailRecord)}>
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-foreground" style={{ backgroundColor: student?.color ?? "var(--avatar-fallback)" }}>{getInitials(student?.name ?? "Student")}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-foreground">{student?.name ?? "Student"}</span>
                      <span className="block text-xs text-muted-foreground">{formatTime(session.startTime)} – {formatTime(session.endTime)}</span>
                    </span>
                    <Badge variant="outline">{session.status}</Badge>
                  </button>
                );
              })}
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}