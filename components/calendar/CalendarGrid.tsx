"use client";

import { useMemo, useState } from "react";

import CalendarDay, { type CalendarStudent } from "@/components/calendar/CalendarDay";
import CalendarSidebar from "@/components/calendar/CalendarSidebar";
import MobileMonthCalendar from "@/components/calendar/MobileMonthCalendar";
import CalendarToolbar from "@/components/calendar/CalendarToolbar";
import SessionDetailsSheet, { type SessionDetailsRecord } from "@/components/sessions/SessionDetailsSheet";
import type { Attendance } from "@/types/attendance";
import type { MonthCalendarDay } from "@/lib/services/sessions";
import type { Session } from "@/types/session";

interface CalendarGridProps {
  attendanceBySession: Readonly<Record<string, Attendance | undefined>>;
  calendarDays: readonly MonthCalendarDay[];
  monthDate: string;
  monthLabel: string;
  sessionsByDate: Readonly<Record<string, Session[]>>;
  sessionDetailsById: Readonly<Record<string, SessionDetailsRecord | undefined>>;
  studentsById: Readonly<Record<string, CalendarStudent>>;
  today: string;
}

const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];



export default function CalendarGrid({
  attendanceBySession,
  calendarDays,
  monthDate,
  monthLabel,
  sessionDetailsById,
  sessionsByDate,
  studentsById,
  today,
}: Readonly<CalendarGridProps>) {
  const [selectedDate, setSelectedDate] = useState<string | null>(today);
  const [selectedSession, setSelectedSession] = useState<SessionDetailsRecord | null>(null);
  const selectedSessions = useMemo(
    () => (selectedDate ? sessionsByDate[selectedDate] ?? [] : []),
    [selectedDate, sessionsByDate]
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

      <MobileMonthCalendar
        calendarDays={calendarDays}
        monthDate={monthDate}
        monthLabel={monthLabel}
        sessionDetailsById={sessionDetailsById}
        sessionsByDate={sessionsByDate}
        studentsById={studentsById}
        today={today}
        onSelectSession={setSelectedSession}
      />

      {selectedDate && (
        <div className="fixed inset-y-0 right-0 z-20 hidden w-96 max-w-[90vw] border-l border-border-strong bg-sidebar shadow-2xl xl:block">
          <CalendarSidebar
            attendanceBySession={attendanceBySession}
            date={selectedDate}
            sessions={selectedSessions}
            studentsById={studentsById}
            onClose={() => setSelectedDate(null)}
            onSelectSession={(session) => setSelectedSession(sessionDetailsById[session.id] ?? null)}
          />
        </div>
      )}

      <SessionDetailsSheet open={Boolean(selectedSession)} onOpenChange={(open) => { if (!open) setSelectedSession(null); }} record={selectedSession} />
    </div>
  );
}
