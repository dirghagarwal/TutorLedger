"use client";

import { useEffect, useState } from "react";

export default function ColorWaveLoader() {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(false);
    }, 900);
    return () => clearTimeout(timer);
  }, []);

  if (!loading) return null;

  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#0B0F19] transition-opacity duration-500"
    >
      <div className="relative flex flex-col items-center gap-4">
        <div className="relative size-16 overflow-hidden rounded-full p-[2px]">
          <div className="absolute inset-0 animate-spin bg-[conic-gradient(from_0deg,#6366F1,#8B5CF6,#EC4899,#6366F1)] motion-reduce:animate-none" />
          <div className="relative flex size-full items-center justify-center rounded-full bg-[#0B0F19]">
            <span className="text-lg font-extrabold tracking-wider text-white">TL</span>
          </div>
        </div>
        <div className="h-1 w-32 overflow-hidden rounded-full bg-white/10">
          <div className="h-full w-1/2 animate-pulse rounded-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 motion-reduce:animate-none" />
        </div>
      </div>
    </div>
  );
}
