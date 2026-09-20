"use client";

import { ArrowLeft } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";

interface BackButtonProps {
  fallback?: string;
}

export default function BackButton({ fallback = "/" }: Readonly<BackButtonProps>) {
  const pathname = usePathname();
  const router = useRouter();

  if (pathname === "/") return null;

  function goBack() {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }
    router.push(fallback);
  }

  return (
    <button
      type="button"
      aria-label="Go back"
      title="Go back"
      onClick={goBack}
      className="inline-flex size-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-white/75 transition hover:bg-white/[0.08] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
    >
      <ArrowLeft className="size-4" />
    </button>
  );
}
