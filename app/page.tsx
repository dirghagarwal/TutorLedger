import Sidebar from "@/components/layout/Sidebar";
import Topbar from "../components/layout/Topbar";
import CommandBar from "../components/workspace/CommandBar";
import Stats from "@/components/workspace/Stats";

export default function Home() {
  return (
    <main className="flex h-screen bg-[#0B0F14]">
      <Sidebar />

      <section className="flex-1 flex flex-col">
        <Topbar />

        <div className="p-8">
          <CommandBar />
          <Stats />
        </div>
      </section>
    </main>
  );
}
