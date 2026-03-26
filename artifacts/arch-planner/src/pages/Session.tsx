import { useState, useEffect, useRef } from "react";
import { useParams } from "wouter";
import { useGetArchitectureSession, useListOpenaiMessages } from "@workspace/api-client-react";
import { useArchitectureFollowup } from "@/hooks/use-architecture-stream";
import { MarkdownRenderer } from "@/components/MarkdownRenderer";
import { Send, User, Bot, Loader2, FileText, Building, FileBox, MessageSquare } from "lucide-react";
import { motion } from "framer-motion";
import { format } from "date-fns";

export default function Session() {
  const { id } = useParams<{ id: string }>();
  const sessionId = parseInt(id);
  
  const { data: session, isLoading: sessionLoading } = useGetArchitectureSession(sessionId);
  const { data: dbMessages, isLoading: messagesLoading, refetch: refetchMessages } = useListOpenaiMessages(
    session?.conversationId ?? 0
  );
  
  const { askFollowup, isAnswering, answerStream } = useArchitectureFollowup();
  
  const [question, setQuestion] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [dbMessages, answerStream]);

  const handleFollowup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim() || isAnswering) return;
    
    const currentQ = question;
    setQuestion("");
    
    await askFollowup(sessionId, currentQ, () => {
      refetchMessages();
    });
  };

  if (sessionLoading) {
    return (
      <div className="flex-1 h-full flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-teal-500 animate-spin" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex-1 h-full flex items-center justify-center text-zinc-500">
        المخطط غير موجود
      </div>
    );
  }

  // Filter out system messages and the initial prompt if they exist in the DB, 
  // or just show user/assistant messages
  const visibleMessages = dbMessages?.filter(m => m.role === 'user' || m.role === 'assistant') || [];

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Session Header */}
      <div className="shrink-0 glass-panel border-x-0 border-t-0 px-6 py-4 flex flex-wrap items-center gap-6 shadow-md z-20">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center">
            <FileText className="w-6 h-6 text-teal-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white leading-tight">
              {session.buildingSubtype || session.buildingType}
            </h2>
            <p className="text-xs text-zinc-400">
              {format(new Date(session.createdAt), "dd MMM yyyy - HH:mm")}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-4 ml-auto text-sm">
          <div className="flex items-center gap-2 bg-zinc-900/50 px-3 py-1.5 rounded-lg border border-zinc-800">
            <Building className="w-4 h-4 text-zinc-400" />
            <span className="text-zinc-200">{session.area} م²</span>
          </div>
          <div className="flex items-center gap-2 bg-zinc-900/50 px-3 py-1.5 rounded-lg border border-zinc-800">
            <FileBox className="w-4 h-4 text-zinc-400" />
            <span className="text-zinc-200">{session.floors} طوابق</span>
          </div>
        </div>
      </div>

      {/* Main Scrollable Area */}
      <div className="flex-1 overflow-y-auto p-4 md:p-8 scrollbar-thin">
        <div className="max-w-4xl mx-auto space-y-8 pb-32">
          
          {/* Main Plan Document */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-panel rounded-3xl p-6 md:p-10 shadow-xl"
          >
            <div className="flex items-center gap-3 mb-6 pb-6 border-b border-zinc-800/50">
              <Bot className="w-6 h-6 text-teal-400" />
              <h3 className="text-lg font-bold text-zinc-100">المخطط المعماري المقترح</h3>
            </div>
            <MarkdownRenderer content={session.generatedPlan} />
          </motion.div>

          {/* Follow-up Chat History */}
          {visibleMessages.length > 1 && ( // > 1 assuming first message is the hidden system/prompt
            <div className="space-y-6 mt-12">
              <div className="flex items-center gap-3 mb-4">
                <MessageSquare className="w-5 h-5 text-indigo-400" />
                <h4 className="text-md font-bold text-zinc-300">النقاش والتعديلات</h4>
              </div>
              
              {visibleMessages.map((msg, idx) => {
                // Skip the giant initial prompt if it's the first user message
                if (idx === 0 && msg.role === 'user' && msg.content.includes(session.buildingType)) return null;
                // Skip the first assistant message if it's identical to the generated plan
                if (idx === 1 && msg.role === 'assistant' && msg.content === session.generatedPlan) return null;

                const isUser = msg.role === "user";
                return (
                  <motion.div 
                    key={msg.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex gap-4 ${isUser ? "flex-row-reverse" : ""}`}
                  >
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                      isUser ? "bg-indigo-500/20 text-indigo-400" : "bg-teal-500/20 text-teal-400"
                    }`}>
                      {isUser ? <User className="w-5 h-5" /> : <Bot className="w-5 h-5" />}
                    </div>
                    <div className={`flex-1 ${isUser ? "pl-12" : "pr-12"}`}>
                      <div className={`p-5 rounded-2xl ${
                        isUser 
                          ? "bg-indigo-500/10 border border-indigo-500/20 text-zinc-200" 
                          : "glass-panel text-zinc-300"
                      }`}>
                        <MarkdownRenderer content={msg.content} />
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}

          {/* Streaming Answer */}
          {isAnswering && answerStream && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex gap-4"
            >
              <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 bg-teal-500/20 text-teal-400">
                <Bot className="w-5 h-5" />
              </div>
              <div className="flex-1 pr-12">
                <div className="p-5 rounded-2xl glass-panel text-zinc-300">
                  <MarkdownRenderer content={answerStream} />
                  <div className="mt-4 flex items-center gap-2 text-zinc-500">
                    <div className="w-2 h-2 rounded-full bg-teal-500 animate-bounce" style={{ animationDelay: "0s" }}></div>
                    <div className="w-2 h-2 rounded-full bg-teal-500 animate-bounce" style={{ animationDelay: "0.2s" }}></div>
                    <div className="w-2 h-2 rounded-full bg-teal-500 animate-bounce" style={{ animationDelay: "0.4s" }}></div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Sticky Input Area */}
      <div className="absolute bottom-0 left-0 right-0 p-4 md:p-6 bg-gradient-to-t from-[#09090b] via-[#09090b]/90 to-transparent z-30">
        <div className="max-w-4xl mx-auto relative">
          <form onSubmit={handleFollowup} className="relative flex items-center">
            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="اسأل سؤالاً أو اطلب تعديلاً على المخطط..."
              disabled={isAnswering}
              className="w-full bg-zinc-900 border border-zinc-700/80 rounded-2xl pl-16 pr-6 py-4 text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 shadow-xl transition-all disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={!question.trim() || isAnswering}
              className="absolute left-3 p-2 bg-teal-500 hover:bg-teal-400 text-white rounded-xl transition-colors disabled:opacity-50 disabled:hover:bg-teal-500"
            >
              {isAnswering ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5 rtl:-scale-x-100" />}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
