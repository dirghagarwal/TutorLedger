import { motion } from "framer-motion";

import type { Session } from "@/types/session";

export interface CalendarStudent {
  name: string;
  color: string;
}

interface CalendarDayProps {
  date: string | null;
  day: number | null;
  isSelected: boolean;
  isToday: boolean;
  sessions: readonly Session[];
  studentsById: Readonly<Record<string, CalendarStudent>>;
  onSelect: (date: string) => void;
}

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter((part) => part !== "&")
    .slice(0, 2)
    .map((part) => part[0] ?? "")
    .join("")
    .toUpperCase();
}

export default function CalendarDay({
  date,
  day,
  isSelected,
  isToday,
  sessions,
  studentsById,
  onSelect,
}: Readonly<CalendarDayProps>) {
  if (!date || day === null) {
    return <div className="min-h-28 border-b border-r border-border/50 bg-surface-subtle/50" />;
  }

  return (
    <motion.button
      className={`min-h-28 border-b border-r border-border/50 p-3 text-left transition-colors hover:bg-primary/5 ${
        isSelected ? "bg-primary/10 ring-1 ring-inset ring-primary/40" : "bg-surface"
      }`}
      type="button"
      whileTap={{ scale: 0.985 }}
      onClick={() => onSelect(date)}
    >
      <span
        className={`flex size-7 items-center justify-center rounded-full text-sm font-medium ${
          isToday ? "bg-primary text-primary-foreground" : "text-secondary-foreground"
        }`}
      >
        {day}
      </span>
      <div className="mt-3 space-y-2">
        {sessions.slice(0, 3).map((session) => {
          const student = studentsById[session.studentId];
          return (
            <div className="flex items-center gap-2" key={session.id}>
              <span
                aria-hidden="true"
                className="flex size-6 shrink-0 items-center justify-center rounded-full text-[9px] font-semibold text-foreground"
                style={{ backgroundColor: student?.color ?? "var(--avatar-fallback)" }}
              >
                {getInitials(student?.name ?? "Student")}
              </span>
              <span className="truncate text-xs text-secondary-foreground">
                {student?.name ?? "Student"}
              </span>
            </div>
          );
        })}
        {sessions.length > 3 && (
          <span className="text-xs text-primary">+{sessions.length - 3} more</span>
        )}
      </div>
    </motion.button>
  );
}
