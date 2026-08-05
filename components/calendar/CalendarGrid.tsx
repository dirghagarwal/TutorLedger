"use client";

import { useMemo, useState } from "react";

import CalendarDay, { type CalendarStudent } from "@/components/calendar/CalendarDay";
import CalendarSidebar from "@/components/calendar/CalendarSidebar";
import CalendarToolbar from "@/components/calendar/CalendarToolbar";
import { formatTime } from "@/lib/services/schedule";
import type { Attendance } from "@/types/attendance";
import type { MonthCalendarDay } from "@/lib/services/sessions";
import type { Session } from "@/types/session";

interface CalendarGridProps {
  attendanceBySession: Readonly<Record<string, Attendance | undefined>>;
  calendarDays: readonly MonthCalendarDay[];
  monthLabel: string;
  sessionsByDate: Readonly<Record<string, Session[]>>;
  studentsById: Readonly<Record<string, CalendarStudent>>;
  today: string;
}

const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter((part) => part !== "&")
    .slice(0, 2)
    .map((part) => part[0] ?? "")
    .join("")
    .toUpperCase();
}

export default function CalendarGrid({
  attendanceBySession,
  calendarDays,
  monthLabel,
  sessionsByDate,
  studentsById,
  today,
}: Readonly<CalendarGridProps>) {
  const [selectedDate, setSelectedDate] = useState<string | null>(today);
  const selectedSessions = useMemo(
    () => (selectedDate ? sessionsByDate[selectedDate] ?? [] : []),
    [selectedDate, sessionsByDate]
  );
  const agendaDays = useMemo(
    () => calendarDays.filter((day): day is MonthCalendarDay & { date: string } => Boolean(day.date && (sessionsByDate[day.date]?.length ?? 0) > 0)),
    [calendarDays, sessionsByDate]
  );

  return (
    <div>
      <CalendarToolbar monthLabel={monthLabel} onToday={() => setSelectedDate(today)} />
      <div className="hidden overflow-hidden rounded-2xl border border-border-strong shadow-floating lg:block">
        <div className="grid grid-cols-7 border-b border-border/50 bg-surface-subtle">
          {weekdays.map((weekday) => (
            <div className="px-3 py-3 text-center text-xs font-medium text-muted-foreground" key={weekday}>
              {weekday}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {calendarDays.map((calendarDay, index) => (
            <CalendarDay
              date={calendarDay.date}
              day={calendarDay.day}
              isSelected={calendarDay.date === selectedDate}
              isToday={calendarDay.date === today}
              key={calendarDay.date ?? `empty-${index}`}
              sessions={calendarDay.date ? sessionsByDate[calendarDay.date] ?? [] : []}
              studentsById={studentsById}
              onSelect={setSelectedDate}
            />
          ))}
        </div>
      </div>

      <div className="space-y-3 lg:hidden">
        {agendaDays.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border-strong bg-surface p-6 text-center text-sm text-muted-foreground">
            No sessions scheduled this month.
          </div>
        ) : agendaDays.map((day) => (
          <section className="overflow-hidden rounded-2xl border border-border-strong bg-surface" key={day.date}>
            <button
              aria-label={`Show sessions for ${day.date}`}
              className={`flex min-h-11 w-full items-center justify-between border-b border-border/50 px-4 py-3 text-left ${day.date === today ? "bg-primary/10" : "bg-surface-subtle"}`}
              type="button"
              onClick={() => setSelectedDate(day.date)}
            >
              <span className="font-medium text-foreground">{day.date}</span>
              <span className="text-xs text-muted-foreground">{sessionsByDate[day.date]?.length} sessions</span>
            </button>
            <div className="divide-y divide-border/50">
              {(sessionsByDate[day.date] ?? []).map((session) => {
                const student = studentsById[session.studentId];
                return (
                  <button className="flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left hover:bg-primary/5" key={session.id} type="button" onClick={() => setSelectedDate(day.date)}>
                    <span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-foreground" style={{ backgroundColor: student?.color ?? "var(--avatar-fallback)" }}>
                      {getInitials(student?.name ?? "Student")}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-foreground">{student?.name ?? "Student"}</span>
                      <span className="block text-xs text-muted-foreground">{formatTime(session.startTime)} – {formatTime(session.endTime)}</span>
                    </span>
                    <span className="text-xs text-primary">{session.status}</span>
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      {selectedDate && (
        <div className="mt-5 overflow-hidden rounded-2xl border border-border-strong xl:hidden">
          <CalendarSidebar
            attendanceBySession={attendanceBySession}
            date={selectedDate}
            sessions={selectedSessions}
            studentsById={studentsById}
            onClose={() => setSelectedDate(null)}
          />
        </div>
      )}

      {selectedDate && (
        <div className="fixed inset-y-0 right-0 z-20 hidden w-96 max-w-[90vw] border-l border-border-strong bg-sidebar shadow-2xl xl:block">
          <CalendarSidebar
            attendanceBySession={attendanceBySession}
            date={selectedDate}
            sessions={selectedSessions}
            studentsById={studentsById}
            onClose={() => setSelectedDate(null)}
          />
        </div>
      )}
    </div>
  );
}
