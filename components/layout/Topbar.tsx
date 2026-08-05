"use client";

import { Bell, Search } from "lucide-react";

import MobileSidebar from "@/components/layout/MobileSidebar";
import { Button } from "@/components/ui/button";

export default function Topbar() {
  return (
    <header className="flex min-h-16 items-center justify-between gap-3 border-b border-border bg-sidebar px-4 sm:px-8">
      <div className="flex min-w-0 items-center gap-2">
        <MobileSidebar />
        <div className="min-w-0">
          <h1 className="truncate text-lg font-bold sm:text-2xl">TutorLedger</h1>
          <p className="hidden text-sm text-muted-foreground sm:block">
          AI Powered Tuition Workspace
          </p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1 sm:gap-3">
        <Button aria-label="Search" className="text-muted-foreground" size="icon" variant="ghost"><Search /></Button>
        <Button aria-label="Notifications" className="text-muted-foreground" size="icon" variant="ghost"><Bell /></Button>

        <div className="flex size-10 items-center justify-center rounded-full bg-primary font-bold text-primary-foreground" aria-label="Account: Dirgh">
          D
        </div>
      </div>
    </header>
  );
}
