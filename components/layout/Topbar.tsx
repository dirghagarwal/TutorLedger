export default function Topbar() {
  return (
    <header className="h-16 border-b border-[#2B3445] bg-[#131922] flex items-center justify-between px-8">
      <div>
        <h2 className="text-xl font-semibold text-white">
          👋 Good Evening, Dirgh
        </h2>
        <p className="text-sm text-slate-400">
          Ready to manage your tuition today?
        </p>
      </div>

      <div className="flex items-center gap-4">
        <button className="h-10 w-10 rounded-xl bg-[#1B2230] hover:bg-[#263142] transition" />
        <button className="h-10 w-10 rounded-xl bg-[#1B2230] hover:bg-[#263142] transition" />
        <div className="h-10 w-10 rounded-full bg-blue-500" />
      </div>
    </header>
  );
}