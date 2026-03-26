import { ReactNode } from "react";
import { Sidebar } from "./Sidebar";

export function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-screen bg-[#09090b] overflow-hidden" dir="rtl">
      <Sidebar />
      <main className="flex-1 relative overflow-y-auto">
        <div className="absolute inset-0 bg-[url('/images/hero-bg.png')] bg-cover bg-center opacity-[0.03] mix-blend-screen pointer-events-none" />
        <div className="relative z-10 h-full">
          {children}
        </div>
      </main>
    </div>
  );
}
