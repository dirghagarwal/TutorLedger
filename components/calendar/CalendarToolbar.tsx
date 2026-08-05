"use client";

import { CalendarDays } from "lucide-react";

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
  );
}
