"use client";

import {
  Home,
  Calendar,
  GraduationCap,
  Wallet,
  BarChart3,
  Settings,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const menuItems = [
  { name: "Workspace", href: "/", icon: Home },
  { name: "Calendar", href: "/calendar", icon: Calendar },
  { name: "Students", href: "/students", icon: GraduationCap },
  { name: "Payments", href: "/payments", icon: Wallet },
  { name: "Reports", href: "/reports", icon: BarChart3 },
] as const;

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-screen w-64 shrink-0 flex-col border-r border-border bg-sidebar">
      {/* Logo */}
      <Link
        href="/"
        className="flex h-16 items-center border-b border-border px-6"
      >
        <h1 className="text-xl font-bold text-foreground">
          Tutor<span className="text-primary">Ledger</span>
        </h1>
      </Link>

      {/* Menu */}
      <nav aria-label="Main navigation" className="flex-1 space-y-2 px-3 py-4">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;

          return (
            <Link
              aria-current={isActive ? "page" : undefined}
              key={item.name}
              href={item.href}
              className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 transition-all duration-200 ${
                isActive
                  ? "bg-primary/15 text-primary"
                  : "text-secondary-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <Icon size={20} />
              <span>{item.name}</span>
            </Link>
          );
        })}
      </nav>

      {/* Bottom */}
      <div className="border-t border-border p-3">
        <Link
          aria-current={pathname === "/settings" ? "page" : undefined}
          href="/settings"
          className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 transition-all duration-200 ${
            pathname === "/settings"
              ? "bg-primary/15 text-primary"
              : "text-secondary-foreground hover:bg-muted hover:text-foreground"
          }`}
        >
          <Settings size={20} />
          <span>Settings</span>
        </Link>
      </div>
    </aside>
  );
}
