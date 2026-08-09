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
import { useSidebar } from "@/components/layout/SidebarContext";

export const menuItems = [
  { name: "Workspace", href: "/", icon: Home },
  { name: "Calendar", href: "/calendar", icon: Calendar },
  { name: "Students", href: "/students", icon: GraduationCap },
  { name: "Payments", href: "/payments", icon: Wallet },
  { name: "Reports", href: "/reports", icon: BarChart3 },
] as const;

export default function Sidebar() {
  const pathname = usePathname();
  const { isCollapsed } = useSidebar();

  return (
    <aside
      className={`hidden h-screen shrink-0 flex-col border-r border-border bg-sidebar transition-all duration-300 ease-in-out lg:flex ${
        isCollapsed ? "w-20" : "w-64"
      }`}
    >
      {/* Logo */}
      <Link
        href="/"
        className={`flex h-16 items-center border-b border-border px-6 ${
          isCollapsed ? "justify-center px-2" : ""
        }`}
        title="TutorLedger"
      >
        {isCollapsed ? (
          <span className="flex size-9 items-center justify-center rounded-xl bg-primary font-bold text-primary-foreground">
            TL
          </span>
        ) : (
          <h1 className="text-xl font-bold text-foreground">
            Tutor<span className="text-primary">Ledger</span>
          </h1>
        )}
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
              title={isCollapsed ? item.name : undefined}
              className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 transition-all duration-200 ${
                isCollapsed ? "justify-center px-0" : ""
              } ${
                isActive
                  ? "bg-primary/15 text-primary font-semibold"
                  : "text-secondary-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <Icon size={20} className="shrink-0" />
              {!isCollapsed && <span>{item.name}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Bottom */}
      <div className="border-t border-border p-3">
        <Link
          aria-current={pathname === "/settings" ? "page" : undefined}
          href="/settings"
          title={isCollapsed ? "Settings" : undefined}
          className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 transition-all duration-200 ${
            isCollapsed ? "justify-center px-0" : ""
          } ${
            pathname === "/settings"
              ? "bg-primary/15 text-primary font-semibold"
              : "text-secondary-foreground hover:bg-muted hover:text-foreground"
          }`}
        >
          <Settings size={20} className="shrink-0" />
          {!isCollapsed && <span>Settings</span>}
        </Link>
      </div>
    </aside>
  );
}
