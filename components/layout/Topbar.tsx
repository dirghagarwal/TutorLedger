"use client";

import { LogOut, PanelLeft, Plus } from "lucide-react";
import Link from "next/link";

import { logoutTeacher } from "@/app/actions/auth";
import AppLauncher from "@/components/layout/AppLauncher";
import BackButton from "@/components/layout/BackButton";
import MobileSidebar from "@/components/layout/MobileSidebar";
import { useSidebar } from "@/components/layout/SidebarContext";
import { Button } from "@/components/ui/button";

export default function Topbar() {
  const { toggleSidebar } = useSidebar();

  return (
    <header className="flex min-h-16 items-center justify-between gap-3 border-b border-border bg-sidebar px-4 sm:px-6 lg:px-8">
      <div className="flex min-w-0 items-center gap-2">
        <BackButton />
        <MobileSidebar />

        <Button
          aria-label="Toggle sidebar"
          title="Toggle sidebar"
          className="hidden lg:flex rounded-xl text-muted-foreground hover:bg-muted"
          size="icon"
          variant="ghost"
          onClick={toggleSidebar}
        >
          <PanelLeft className="size-4.5" />
        </Button>

        <div className="min-w-0 pl-1">
          <h1 className="truncate text-lg font-bold sm:text-xl">TutorLedger</h1>
          <p className="hidden text-xs text-muted-foreground sm:block">
            AI Powered Tuition Workspace
          </p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
        <Link
          href="/record"
          aria-label="Record class"
          title="Record class"
          className="flex h-10 items-center gap-1.5 rounded-xl border border-primary/25 bg-primary/10 px-2.5 sm:px-3 text-xs sm:text-sm font-medium text-primary transition hover:bg-primary/15"
        >
          <Plus className="size-4" />
          <span className="inline">Record class</span>
        </Link>

        <AppLauncher />

        <form action={logoutTeacher}>
          <button
            type="submit"
            aria-label="Sign out"
            title="Sign out"
            className="flex size-10 items-center justify-center rounded-xl bg-white/[0.04] text-white/70 ring-1 ring-white/10 transition hover:bg-white/[0.08] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
          >
            <LogOut className="size-4" />
          </button>
        </form>
      </div>
    </header>
  );
}
