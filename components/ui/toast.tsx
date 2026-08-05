"use client";

import { CheckCircle2, X, XCircle } from "lucide-react";
import { createContext, useCallback, useContext, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";

type ToastVariant = "success" | "error" | "info";
interface ToastItem { id: string; title: string; description?: string; variant: ToastVariant }
interface ToastContextValue { toast: (item: Omit<ToastItem, "id">) => void }

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: Readonly<{ children: React.ReactNode }>) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const toast = useCallback((item: Omit<ToastItem, "id">) => {
    const id = crypto.randomUUID();
    setItems((current) => [...current, { ...item, id }].slice(-4));
    window.setTimeout(() => setItems((current) => current.filter((toastItem) => toastItem.id !== id)), 4500);
  }, []);
  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div aria-label="Notifications" className="pointer-events-none fixed right-4 bottom-4 z-[100] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2" role="region">
        {items.map((item) => <ToastCard item={item} key={item.id} onDismiss={() => setItems((current) => current.filter((toastItem) => toastItem.id !== item.id))} />)}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used within ToastProvider");
  return context;
}

function ToastCard({ item, onDismiss }: Readonly<{ item: ToastItem; onDismiss: () => void }>) {
  const Icon = item.variant === "success" ? CheckCircle2 : item.variant === "error" ? XCircle : CheckCircle2;
  return (
    <div aria-live="polite" className="pointer-events-auto flex items-start gap-3 rounded-xl border border-border-strong bg-surface p-4 text-foreground shadow-floating">
      <Icon className={item.variant === "error" ? "mt-0.5 size-5 text-destructive" : "mt-0.5 size-5 text-success"} />
      <div className="min-w-0 flex-1"><p className="text-sm font-semibold">{item.title}</p>{item.description && <p className="mt-1 text-xs text-muted-foreground">{item.description}</p>}</div>
      <Button aria-label="Dismiss notification" className="-mr-2 -mt-2" size="icon-sm" variant="ghost" onClick={onDismiss}><X /></Button>
    </div>
  );
}
