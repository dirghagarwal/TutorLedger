"use client";

import { Grid2X2, Plus } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { menuItems } from "@/components/layout/Sidebar";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

const launcherItems = [
  ...menuItems.map((item) => ({ ...item, kind: "nav" as const })),
  { name: "Record class", href: "/record", icon: Plus, kind: "action" as const },
] as const;

export default function AppLauncher() {
  const pathname = usePathname();

  return (
    <Sheet>
      <SheetTrigger
        aria-label="Open app launcher"
        title="Open app launcher"
        render={<Button size="icon" variant="ghost" className="rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground" />}
      >
        <Grid2X2 className="size-4.5" />
      </SheetTrigger>

      <SheetContent side="right" className="w-[min(22rem,calc(100vw-1rem))] bg-sidebar p-0">
        <SheetHeader className="border-b border-border px-5 py-5 text-left">
          <SheetTitle className="text-lg text-foreground">TutorLedger</SheetTitle>
          <SheetDescription>Jump to a workspace area or record a class manually.</SheetDescription>
        </SheetHeader>

        <nav aria-label="App launcher" className="grid grid-cols-2 gap-2 p-4">
          {launcherItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            const itemClassName =
              "flex min-h-24 flex-col items-start justify-between rounded-2xl border p-4 text-left transition " +
              (isActive
                ? "border-primary/30 bg-primary/10 text-primary"
                : item.kind === "action"
                  ? "border-primary/20 bg-primary/[0.06] text-primary hover:bg-primary/10"
                  : "border-border bg-surface text-secondary-foreground hover:border-border-strong hover:bg-muted hover:text-foreground");

            return (
              <Link
                aria-current={isActive ? "page" : undefined}
                href={item.href}
                key={item.name}
                className={itemClassName}
              >
                <Icon className="size-5" />
                <span className="text-sm font-medium">{item.name}</span>
              </Link>
            );
          })}

          <Link
            href="/settings"
            className={
              "flex min-h-24 flex-col items-start justify-between rounded-2xl border p-4 text-left transition " +
              (pathname === "/settings"
                ? "border-primary/30 bg-primary/10 text-primary"
                : "border-border bg-surface text-secondary-foreground hover:border-border-strong hover:bg-muted hover:text-foreground")
            }
          >
            <span className="text-lg font-semibold">⚙</span>
            <span className="text-sm font-medium">Settings</span>
          </Link>
        </nav>
      </SheetContent>
    </Sheet>
  );
}
