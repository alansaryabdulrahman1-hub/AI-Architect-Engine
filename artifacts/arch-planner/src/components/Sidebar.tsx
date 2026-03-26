import { Link, useLocation } from "wouter";
import { Plus, LayoutGrid, Trash2, Home, MessageSquare } from "lucide-react";
import { useListArchitectureSessions, useDeleteArchitectureSession, getListArchitectureSessionsQueryKey } from "@workspace/api-client-react";
import { format } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";

export function Sidebar() {
  const [location] = useLocation();
  const { data: sessions, isLoading } = useListArchitectureSessions();
  const { mutate: deleteSession } = useDeleteArchitectureSession();
  const queryClient = useQueryClient();

  const handleDelete = (e: React.MouseEvent, id: number) => {
    e.preventDefault(); // Prevent navigation
    if (confirm("هل أنت متأكد من حذف هذا المخطط؟")) {
      deleteSession({ id }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListArchitectureSessionsQueryKey() });
        }
      });
    }
  };

  return (
    <div className="w-72 bg-[#0c0c0e] border-l border-zinc-800/50 h-screen flex flex-col flex-shrink-0 z-10 hidden md:flex shadow-2xl">
      <div className="p-6">
        <Link href="/">
          <div className="flex items-center gap-3 cursor-pointer group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-teal-500/20 group-hover:shadow-teal-500/40 transition-all duration-300">
              <LayoutGrid className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-display font-bold text-white tracking-tight">مخطط AI</h1>
              <p className="text-xs text-zinc-400 font-sans">المهندس المعماري الذكي</p>
            </div>
          </div>
        </Link>
      </div>

      <div className="px-4 pb-4">
        <Link href="/">
          <button className="w-full flex items-center justify-center gap-2 bg-zinc-800/50 hover:bg-zinc-800 text-zinc-200 py-3 rounded-xl border border-zinc-700/50 transition-all duration-200 font-medium">
            <Plus className="w-4 h-4" />
            <span>مشروع جديد</span>
          </button>
        </Link>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-6 scrollbar-thin">
        <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-4 mt-2 px-2">
          مشاريع سابقة
        </h3>
        
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-16 bg-zinc-900/50 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : sessions?.length === 0 ? (
          <div className="text-center py-8 px-4 text-zinc-500 text-sm">
            لا توجد مخططات سابقة. ابدأ مشروعك الأول الآن.
          </div>
        ) : (
          <div className="space-y-2">
            {sessions?.map((session) => {
              const isActive = location === `/sessions/${session.id}`;
              return (
                <Link key={session.id} href={`/sessions/${session.id}`}>
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`
                      group relative p-3 rounded-xl cursor-pointer transition-all duration-200 border
                      ${isActive 
                        ? 'bg-zinc-800/80 border-zinc-700 shadow-md' 
                        : 'bg-zinc-900/30 border-transparent hover:bg-zinc-800/50 hover:border-zinc-800'}
                    `}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0 pr-2">
                        <h4 className="text-sm font-medium text-zinc-200 truncate">
                          {session.buildingSubtype || session.buildingType}
                        </h4>
                        <div className="flex items-center gap-2 mt-1 text-xs text-zinc-500">
                          <span>{session.area} م²</span>
                          <span>•</span>
                          <span>{session.floors} طوابق</span>
                        </div>
                      </div>
                      <button 
                        onClick={(e) => handleDelete(e, session.id)}
                        className="opacity-0 group-hover:opacity-100 p-1.5 text-zinc-500 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-all"
                        title="حذف"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </motion.div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
