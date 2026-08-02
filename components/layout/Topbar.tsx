"use client";

import { Bell, Search } from "lucide-react";

export default function Topbar() {
  return (
    <header className="h-16 border-b border-[#2B3445] bg-[#131922] px-8 flex items-center justify-between">
      <div>
        <h1 className="text-2xl font-bold">TutorLedger</h1>
        <p className="text-sm text-slate-400">
          AI Powered Tuition Workspace
        </p>
      </div>

      <div className="flex items-center gap-4">
        <Search className="text-slate-400" />
        <Bell className="text-slate-400" />

        <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center font-bold">
          D
        </div>
      </div>
    </header>
  );
}