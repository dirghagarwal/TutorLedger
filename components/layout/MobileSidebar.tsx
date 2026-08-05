"use client";

import { Menu, Settings } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

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

export default function MobileSidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        aria-label="Open navigation menu"
        render={<Button className="lg:hidden" size="icon" variant="ghost" />}
      >
        <Menu />
      </SheetTrigger>
      <SheetContent className="w-[min(22rem,calc(100vw-1rem))] bg-sidebar p-0" side="left">
        <SheetHeader className="border-b border-border px-5 py-5 text-left">
          <SheetTitle className="text-xl text-foreground">Tutor<span className="text-primary">Ledger</span></SheetTitle>
          <SheetDescription>Navigate your tuition workspace.</SheetDescription>
        </SheetHeader>
        <nav aria-label="Mobile navigation" className="flex flex-col gap-2 p-4">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                aria-current={isActive ? "page" : undefined}
                className={`flex min-h-11 items-center gap-3 rounded-xl px-4 py-3 text-sm transition-colors ${isActive ? "bg-primary/15 text-primary" : "text-secondary-foreground hover:bg-muted hover:text-foreground"}`}
                href={item.href}
                key={item.name}
                onClick={() => setOpen(false)}
              >
                <Icon size={20} />
                {item.name}
              </Link>
            );
          })}
          <Link
            aria-current={pathname === "/settings" ? "page" : undefined}
            className={`flex min-h-11 items-center gap-3 rounded-xl px-4 py-3 text-sm transition-colors ${pathname === "/settings" ? "bg-primary/15 text-primary" : "text-secondary-foreground hover:bg-muted hover:text-foreground"}`}
            href="/settings"
            onClick={() => setOpen(false)}
          >
            <Settings size={20} />
            Settings
          </Link>
        </nav>
      </SheetContent>
    </Sheet>
  );
}
