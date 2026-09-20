"use client";

import { CalendarDays, CalendarPlus } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";

interface CalendarToolbarProps {
  monthLabel: string;
  onToday: () => void;
}

export default function CalendarToolbar({
  monthLabel,
  onToday,
}: Readonly<CalendarToolbarProps>) {
  return (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <CalendarDays className="size-5" />
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Schedule overview</p>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            {monthLabel}
          </h1>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Link
          href="/record"
          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-primary/25 bg-primary/10 px-2.5 text-xs font-medium text-primary transition hover:bg-primary/15"
        >
          <CalendarPlus className="size-3.5" />
          Record class
        </Link>
        <Button
          className="border-input bg-card text-secondary-foreground hover:bg-muted"
          size="sm"
          type="button"
          variant="outline"
          onClick={onToday}
        >
          Today
        </Button>
      </div>
    </div>
  );
}
