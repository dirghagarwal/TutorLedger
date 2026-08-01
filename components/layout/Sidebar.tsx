"use client";

import {
  Home,
  Calendar,
  GraduationCap,
  Wallet,
  BarChart3,
  Settings,
} from "lucide-react";

const menuItems = [
  { name: "Workspace", icon: Home },
  { name: "Calendar", icon: Calendar },
  { name: "Students", icon: GraduationCap },
  { name: "Payments", icon: Wallet },
  { name: "Reports", icon: BarChart3 },
];

export default function Sidebar() {
  return (
    <aside className="w-64 h-screen bg-[#131922] border-r border-[#2B3445] flex flex-col">
      {/* Logo */}
      <div className="h-16 flex items-center px-6 border-b border-[#2B3445]">
        <h1 className="text-xl font-bold text-white">
          Tutor<span className="text-blue-400">Ledger</span>
        </h1>
      </div>

      {/* Menu */}
      <nav className="flex-1 px-3 py-4 space-y-2">
        {menuItems.map((item) => {
          const Icon = item.icon;

          return (
            <button
              key={item.name}
              className="w-full flex items-center gap-3 rounded-xl px-4 py-3 text-slate-300 hover:bg-[#1B2230] hover:text-white transition-all duration-200"
            >
              <Icon size={20} />
              <span>{item.name}</span>
            </button>
          );
        })}
      </nav>

      {/* Bottom */}
      <div className="border-t border-[#2B3445] p-3">
        <button className="w-full flex items-center gap-3 rounded-xl px-4 py-3 text-slate-300 hover:bg-[#1B2230] hover:text-white transition-all duration-200">
          <Settings size={20} />
          <span>Settings</span>
        </button>
      </div>
    </aside>
  );
}