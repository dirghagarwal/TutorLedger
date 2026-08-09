"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

interface SidebarContextType {
  isCollapsed: boolean;
  toggleSidebar: () => void;
  setCollapsed: (collapsed: boolean) => void;
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
}

const SidebarContext = createContext<SidebarContextType>({
  isCollapsed: false,
  toggleSidebar: () => {},
  setCollapsed: () => {},
  mobileOpen: false,
  setMobileOpen: () => {},
});

export function SidebarProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [isCollapsed, setIsCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      return localStorage.getItem("tutorledger_sidebar_collapsed") === "true";
    } catch {
      return false;
    }
  });
  const [mobileOpen, setMobileOpen] = useState(false);

  function toggleSidebar() {
    setIsCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("tutorledger_sidebar_collapsed", String(next));
      } catch {
        // localStorage fallback
      }
      return next;
    });
  }

  function setCollapsed(collapsed: boolean) {
    setIsCollapsed(collapsed);
    try {
      localStorage.setItem("tutorledger_sidebar_collapsed", String(collapsed));
    } catch {
      // localStorage fallback
    }
  }

  return (
    <SidebarContext.Provider
      value={{
        isCollapsed,
        toggleSidebar,
        setCollapsed,
        mobileOpen,
        setMobileOpen,
      }}
    >
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  return useContext(SidebarContext);
}
