"use client";

import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Clock3 } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

function formatDayLabel(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(d.getTime())) return dateStr;
  return new Intl.DateTimeFormat("en-IN", { weekday: "short", day: "numeric", month: "short" }).format(d);
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

  const monthDateObject = useMemo(() => {
    const valid = /^\d{4}-\d{2}$/.test(monthDate) ? monthDate : null;
    const d = valid ? new Date(`${valid}-01T00:00:00`) : new Date();
    return Number.isNaN(d.getTime()) ? new Date() : d;
  }, [monthDate]);

  function goToMonth(nextDate: Date) {
    if (Number.isNaN(nextDate.getTime())) return;
    const next = new URLSearchParams(searchParams.toString());
    next.set("month", monthKey(nextDate));
    router.push(`?${next.toString()}`);
  }

  return (
    <div className="space-y-4 lg:hidden">
      {/* Calendar Month Controls */}
      <div className="flex items-center justify-between gap-2 rounded-2xl border border-border/80 bg-surface/80 p-3 shadow-card backdrop-blur-md">
        <div className="flex items-center gap-2">
          <Button
            aria-label="Previous month"
            className="size-9 border-border/60 bg-card/60 hover:bg-muted"
            size="icon"
            variant="outline"
            onClick={() => goToMonth(addMonths(monthDateObject, -1))}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button
            aria-label="Next month"
            className="size-9 border-border/60 bg-card/60 hover:bg-muted"
            size="icon"
            variant="outline"
            onClick={() => goToMonth(addMonths(monthDateObject, 1))}
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>

        <div className="text-center">
          <h2 className="text-base font-bold text-foreground">{monthLabel}</h2>
        </div>

        <Button
          className="h-9 px-3 text-xs font-semibold"
          variant="secondary"
          onClick={() => {
            goToMonth(startOfMonth(new Date()));
            setSelectedDay(today);
          }}
        >
          Today
        </Button>
      </div>

      {/* 7-Column Google Calendar Mobile Month Grid */}
      <div
        className="overflow-hidden rounded-2xl border border-border/80 bg-surface shadow-card"
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
        <div className="grid grid-cols-7 border-b border-border/50 bg-surface-subtle/80 text-center text-[11px] font-bold tracking-wider text-muted-foreground uppercase">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
            <div className="py-2.5" key={day}>
              {day}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 divide-x divide-y divide-border/40">
          {calendarDays.map((calendarDay, index) => {
            const date = calendarDay.date;
            const sessions = date ? sessionsByDate[date] ?? [] : [];
            const isSelected = date === selectedDay;
            const isToday = date === today;

            return (
              <button
                className={`flex aspect-square min-h-[52px] flex-col items-center justify-between p-1.5 transition-all touch-manipulation ${
                  date ? "bg-surface hover:bg-surface-subtle" : "bg-surface-subtle/30"
                } ${isSelected ? "bg-primary/15 ring-2 ring-inset ring-primary" : ""}`}
                disabled={!date}
                key={date ?? `empty-${index}`}
                type="button"
                onClick={() => date && setSelectedDay(date)}
              >
                {date && (
                  <>
                    <span
                      className={`flex size-6 items-center justify-center rounded-full text-xs font-bold ${
                        isToday
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : isSelected
                            ? "text-primary font-extrabold"
                            : "text-foreground/90"
                      }`}
                    >
                      {calendarDay.day}
                    </span>

                    <div className="flex max-w-full flex-wrap items-center justify-center gap-0.5 pb-0.5">
                      {sessions.slice(0, 3).map((session) => {
                        const student = studentsById[session.studentId];
                        return (
                          <span
                            aria-label={student?.name ?? "Session"}
                            className="size-1.5 rounded-full shadow-xs"
                            key={session.id}
                            style={{ backgroundColor: student?.color ?? "var(--primary)" }}
                          />
                        );
                      })}
                      {sessions.length > 3 && (
                        <span className="text-[9px] font-bold text-primary">+{sessions.length - 3}</span>
                      )}
                    </div>
                  </>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Inline Selected Date Agenda */}
      {selectedDay && (
        <div className="rounded-2xl border border-border/80 bg-surface/90 p-4 shadow-card">
          <div className="mb-3 flex items-center justify-between border-b border-border/40 pb-2">
            <h3 className="flex items-center gap-2 text-sm font-bold text-foreground">
              <CalendarIcon className="size-4 text-primary" />
              {formatDayLabel(selectedDay)}
            </h3>
            <Badge variant="outline">{selectedSessions.length} {selectedSessions.length === 1 ? "Session" : "Sessions"}</Badge>
          </div>

          {selectedSessions.length === 0 ? (
            <p className="py-4 text-center text-xs text-muted-foreground">No sessions scheduled for this day.</p>
          ) : (
            <div className="grid gap-2.5">
              {selectedSessions.map((session) => {
                const student = studentsById[session.studentId];
                const detailRecord = sessionDetailsById[session.id] ?? {
                  session,
                  studentName: student?.name ?? "Student",
                  studentColor: student?.color ?? "var(--avatar-fallback)",
                  attendance: null,
                  payments: [],
                  notes: [],
                  attachments: [],
                };

                return (
                  <button
                    className="flex w-full items-center gap-3 rounded-xl border border-border/60 bg-surface-subtle/70 p-3 text-left transition-all hover:border-primary/50 hover:bg-primary/5 active:scale-[0.99] touch-manipulation"
                    key={session.id}
                    type="button"
                    onClick={() => onSelectSession(detailRecord)}
                  >
                    <span
                      className="flex size-10 shrink-0 items-center justify-center rounded-full text-xs font-bold text-foreground shadow-xs"
                      style={{ backgroundColor: student?.color ?? "var(--avatar-fallback)" }}
                    >
                      {getInitials(student?.name ?? "ST")}
                    </span>

                    <div className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-foreground">
                        {student?.name ?? "Student"}
                      </span>
                      <span className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock3 className="size-3.5" />
                        {formatTime(session.startTime)} – {formatTime(session.endTime)}
                      </span>
                    </div>

                    <Badge variant={session.status === "COMPLETED" ? "default" : session.status === "IN_PROGRESS" ? "secondary" : "outline"}>
                      {session.status}
                    </Badge>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}