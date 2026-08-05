"use client";

import { Bell, Search } from "lucide-react";

export default function Topbar() {
  return (
    <header className="flex h-16 items-center justify-between border-b border-border bg-sidebar px-8">
      <div>
        <h1 className="text-2xl font-bold">TutorLedger</h1>
        <p className="text-sm text-muted-foreground">
          AI Powered Tuition Workspace
        </p>
      </div>

      <div className="flex items-center gap-4">
        <Search className="text-muted-foreground" />
        <Bell className="text-muted-foreground" />

        <div className="flex size-10 items-center justify-center rounded-full bg-primary font-bold text-primary-foreground">
          D
        </div>
      </div>
    </header>
  );
}
