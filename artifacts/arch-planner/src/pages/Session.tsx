import { useState, useEffect, useRef } from "react";
import { useParams } from "wouter";
import { useGetArchitectureSession, useListOpenaiMessages } from "@workspace/api-client-react";
import { useArchitectureFollowup } from "@/hooks/use-architecture-stream";
import { MarkdownRenderer } from "@/components/MarkdownRenderer";
import { ImageUpload } from "@/components/ImageUpload";
import { Send, User, Bot, Loader2, FileText, Building, FileBox, MessageSquare, Download, Image as ImageIcon, CheckCircle2, Package, AlertTriangle } from "lucide-react";
import { motion } from "framer-motion";
import { format } from "date-fns";

interface PendingMessage {
  text: string;
  images?: string[];
}

export default function Session() {
  const { id } = useParams<{ id: string }>();
  const sessionId = parseInt(id);
  
  const { data: session, isLoading: sessionLoading, refetch: refetchSession } = useGetArchitectureSession(sessionId);
  const { data: dbMessages, isLoading: messagesLoading, refetch: refetchMessages } = useListOpenaiMessages(
    session?.conversationId ?? 0
  );
  
  const { askFollowup, isAnswering, answerStream, generatedImages } = useArchitectureFollowup();
  
  const [question, setQuestion] = useState("");
  const [followupImages, setFollowupImages] = useState<string[]>([]);
  const [pendingUserMessage, setPendingUserMessage] = useState<PendingMessage | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [assetsPollActive, setAssetsPollActive] = useState(false);
  const [assetsPollTimedOut, setAssetsPollTimedOut] = useState(false);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [dbMessages, answerStream, pendingUserMessage, generatedImages]);

  useEffect(() => {
    if (session && (!session.floorPlanImageUrl || !session.exteriorImageUrl || !session.dxfReady)) {
      setAssetsPollActive(true);
      setAssetsPollTimedOut(false);
    }
  }, [session?.id]);

  useEffect(() => {
    if (!assetsPollActive || !session) return;

    const interval = setInterval(async () => {
      const result = await refetchSession();
      const updated = result.data;
      if (updated?.floorPlanImageUrl && updated?.exteriorImageUrl && updated?.dxfReady) {
        setAssetsPollActive(false);
      }
    }, 5000);

    const timeout = setTimeout(() => {
      setAssetsPollActive(false);
      setAssetsPollTimedOut(true);
    }, 120000);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [assetsPollActive, session?.id]);

  const planReady = !!session?.generatedPlan;
  const ifcReady = !!session?.dxfReady;
  const floorPlanReady = !!session?.floorPlanImageUrl;
  const exteriorReady = !!session?.exteriorImageUrl;
  const allAssetsReady = planReady && ifcReady && floorPlanReady && exteriorReady;

  const handleFollowup = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if ((!question.trim() && followupImages.length === 0) || isAnswering) return;
    
    const currentQ = question;
    const currentImages = [...followupImages];
    setQuestion("");
    setFollowupImages([]);
    
    setPendingUserMessage({ text: currentQ, images: currentImages.length > 0 ? currentImages : undefined });
    
    try {
      await askFollowup(sessionId, currentQ, currentImages.length > 0 ? currentImages : undefined, async () => {
        await refetchMessages();
        setPendingUserMessage(null);
      });
    } catch {
      await refetchMessages();
      setPendingUserMessage(null);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleFollowup();
    }
  };

  const handleDownloadIfc = () => {
    const link = document.createElement("a");
    link.href = `/api/architecture/sessions/${sessionId}/ifc`;
    link.download = `plan-${sessionId}.ifc`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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

  const visibleMessages = dbMessages?.filter(m => m.role === 'user' || m.role === 'assistant') || [];

  return (
    <div className="flex flex-col h-full overflow-hidden">
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

      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto p-4 md:p-8 scrollbar-thin">
          <div className="max-w-4xl mx-auto space-y-8 pb-8">

            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-indigo-500/10 border border-indigo-500/20 rounded-2xl p-5 md:p-6"
            >
              <div className="flex items-center gap-3 mb-4 pb-3 border-b border-indigo-500/10">
                <User className="w-5 h-5 text-indigo-400" />
                <h4 className="text-sm font-semibold text-indigo-300">ملخص طلب المستخدم</h4>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm text-zinc-300">
                <div><span className="text-zinc-500">النوع: </span>{session.buildingSubtype || session.buildingType}</div>
                <div><span className="text-zinc-500">المساحة: </span>{session.area} م²</div>
                <div><span className="text-zinc-500">الأدوار: </span>{session.floors}</div>
                {session.sideNorth != null && <div><span className="text-zinc-500">شمال: </span>{session.sideNorth} م</div>}
                {session.sideSouth != null && <div><span className="text-zinc-500">جنوب: </span>{session.sideSouth} م</div>}
                {session.sideEast != null && <div><span className="text-zinc-500">شرق: </span>{session.sideEast} م</div>}
                {session.sideWest != null && <div><span className="text-zinc-500">غرب: </span>{session.sideWest} م</div>}
                {session.facadeDirection && <div><span className="text-zinc-500">الواجهة: </span>{session.facadeDirection}</div>}
                {session.bedroomCount != null && <div><span className="text-zinc-500">غرف النوم: </span>{session.bedroomCount}</div>}
                {session.kitchenType && <div><span className="text-zinc-500">المطبخ: </span>{session.kitchenType === 'open' ? 'مفتوح' : 'مغلق'}</div>}
                {session.acType && <div><span className="text-zinc-500">التكييف: </span>{session.acType}</div>}
                {session.stairLocation && <div><span className="text-zinc-500">الدرج: </span>{session.stairLocation}</div>}
                {session.deedNumber && <div><span className="text-zinc-500">رقم الصك: </span>{session.deedNumber}</div>}
                {session.plotNumber && <div><span className="text-zinc-500">رقم القطعة: </span>{session.plotNumber}</div>}
                {session.neighborEast && <div><span className="text-zinc-500">الجار الشرقي: </span>{session.neighborEast}{session.neighborEastWindows ? ` (نوافذ: ${session.neighborEastWindows})` : ""}</div>}
                {session.neighborWest && <div><span className="text-zinc-500">الجار الغربي: </span>{session.neighborWest}{session.neighborWestWindows ? ` (نوافذ: ${session.neighborWestWindows})` : ""}</div>}
                {session.neighborSouth && <div><span className="text-zinc-500">الجار الجنوبي: </span>{session.neighborSouth}{session.neighborSouthWindows ? ` (نوافذ: ${session.neighborSouthWindows})` : ""}</div>}
                {session.soilType && <div><span className="text-zinc-500">نوع التربة: </span>{session.soilType}</div>}
                {session.budgetRange && <div><span className="text-zinc-500">الميزانية: </span>{session.budgetRange}</div>}
              </div>
              {session.additionalRequirements && (
                <div className="mt-3 pt-3 border-t border-indigo-500/10 text-sm text-zinc-400">
                  <span className="text-zinc-500">متطلبات إضافية: </span>{session.additionalRequirements}
                </div>
              )}
            </motion.div>
            
            {!allAssetsReady && (
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.03 }}
                className="bg-zinc-900/60 border border-zinc-700/40 rounded-2xl p-5"
              >
                <div className="flex items-center gap-3 mb-4 pb-3 border-b border-zinc-700/30">
                  <Package className="w-5 h-5 text-teal-400" />
                  <h4 className="text-sm font-semibold text-zinc-200">الحزمة المعمارية</h4>
                  {assetsPollActive && <Loader2 className="w-4 h-4 text-teal-500 animate-spin mr-auto" />}
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                  {[
                    { ready: planReady, label: "المخطط" },
                    { ready: ifcReady, label: "ملف IFC" },
                    { ready: floorPlanReady, label: "صورة 2D" },
                    { ready: exteriorReady, label: "واجهة 3D" },
                  ].map(({ ready, label }) => {
                    const timedOut = !ready && assetsPollTimedOut;
                    return (
                      <div key={label} className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${
                        ready ? 'border-teal-500/30 bg-teal-500/10 text-teal-300' :
                        timedOut ? 'border-amber-500/30 bg-amber-500/10 text-amber-400' :
                        'border-zinc-700/30 bg-zinc-800/50 text-zinc-500'
                      }`}>
                        {ready ? <CheckCircle2 className="w-4 h-4" /> :
                         timedOut ? <AlertTriangle className="w-4 h-4" /> :
                         <Loader2 className="w-4 h-4 animate-spin" />}
                        <span>{label}</span>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            )}

            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className="glass-panel rounded-3xl p-6 md:p-10 shadow-xl"
            >
              <div className="flex items-center gap-3 mb-6 pb-6 border-b border-zinc-800/50">
                <Bot className="w-6 h-6 text-teal-400" />
                <h3 className="text-lg font-bold text-zinc-100">المخطط المعماري المقترح</h3>
              </div>
              <MarkdownRenderer content={session.generatedPlan} />

              <div className="mt-8 pt-6 border-t border-zinc-800/50 flex flex-wrap items-center gap-4">
                <button
                  onClick={handleDownloadIfc}
                  disabled={!ifcReady}
                  className="flex items-center gap-3 px-6 py-3 bg-teal-600 hover:bg-teal-500 text-white rounded-xl transition-colors shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {ifcReady ? (
                    <Download className="w-5 h-5" />
                  ) : (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  )}
                  <span className="font-medium">تحميل ملف Revit (.IFC)</span>
                </button>
                {ifcReady && (
                  <span className="flex items-center gap-1.5 text-sm text-teal-400">
                    <CheckCircle2 className="w-4 h-4" />
                    جاهز
                  </span>
                )}
              </div>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="glass-panel rounded-2xl overflow-hidden shadow-lg"
              >
                <div className="px-5 py-3 border-b border-zinc-800/50 flex items-center gap-2">
                  <ImageIcon className="w-4 h-4 text-teal-400" />
                  <span className="text-sm font-semibold text-zinc-200">المخطط ثنائي الأبعاد</span>
                  {floorPlanReady && <CheckCircle2 className="w-3.5 h-3.5 text-teal-400 mr-auto" />}
                </div>
                <div className="aspect-square bg-zinc-900/50 flex items-center justify-center">
                  {session.floorPlanImageUrl ? (
                    <img
                      src={session.floorPlanImageUrl}
                      alt="المخطط ثنائي الأبعاد"
                      className="w-full h-full object-cover"
                    />
                  ) : assetsPollTimedOut && !assetsPollActive ? (
                    <div className="flex flex-col items-center gap-3 text-zinc-500 p-6 text-center">
                      <ImageIcon className="w-8 h-8 text-zinc-600" />
                      <span className="text-sm">تعذّر توليد المخطط. ستتم المحاولة عند الجلسة القادمة.</span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-3 text-zinc-500">
                      <Loader2 className="w-8 h-8 animate-spin text-teal-500/50" />
                      <span className="text-sm">جاري توليد المخطط...</span>
                    </div>
                  )}
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="glass-panel rounded-2xl overflow-hidden shadow-lg"
              >
                <div className="px-5 py-3 border-b border-zinc-800/50 flex items-center gap-2">
                  <Building className="w-4 h-4 text-indigo-400" />
                  <span className="text-sm font-semibold text-zinc-200">الواجهة الخارجية</span>
                  {exteriorReady && <CheckCircle2 className="w-3.5 h-3.5 text-teal-400 mr-auto" />}
                </div>
                <div className="aspect-square bg-zinc-900/50 flex items-center justify-center">
                  {session.exteriorImageUrl ? (
                    <img
                      src={session.exteriorImageUrl}
                      alt="الواجهة الخارجية"
                      className="w-full h-full object-cover"
                    />
                  ) : assetsPollTimedOut && !assetsPollActive ? (
                    <div className="flex flex-col items-center gap-3 text-zinc-500 p-6 text-center">
                      <Building className="w-8 h-8 text-zinc-600" />
                      <span className="text-sm">تعذّر توليد الواجهة. ستتم المحاولة عند الجلسة القادمة.</span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-3 text-zinc-500">
                      <Loader2 className="w-8 h-8 animate-spin text-indigo-500/50" />
                      <span className="text-sm">جاري توليد الواجهة...</span>
                    </div>
                  )}
                </div>
              </motion.div>
            </div>

            {(visibleMessages.length > 1 || pendingUserMessage || isAnswering) && (
              <div className="space-y-6 mt-12">
                <div className="flex items-center gap-3 mb-4">
                  <MessageSquare className="w-5 h-5 text-indigo-400" />
                  <h4 className="text-md font-bold text-zinc-300">النقاش والتعديلات</h4>
                </div>
                
                {visibleMessages.map((msg, idx) => {
                  if (idx === 0 && msg.role === 'user' && msg.content.includes(session.buildingType)) return null;
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

                {pendingUserMessage && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex gap-4 flex-row-reverse"
                  >
                    <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 bg-indigo-500/20 text-indigo-400">
                      <User className="w-5 h-5" />
                    </div>
                    <div className="flex-1 pl-12">
                      <div className="p-5 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-zinc-200">
                        <p>{pendingUserMessage.text}</p>
                        {pendingUserMessage.images && pendingUserMessage.images.length > 0 && (
                          <div className="flex gap-2 mt-3">
                            {pendingUserMessage.images.map((img, i) => (
                              <img key={i} src={img} alt="مرفق" className="w-16 h-16 rounded-lg object-cover border border-zinc-700" />
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                )}

                {isAnswering && !answerStream && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex gap-4"
                  >
                    <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 bg-teal-500/20 text-teal-400">
                      <Bot className="w-5 h-5" />
                    </div>
                    <div className="flex-1 pr-12">
                      <div className="p-5 rounded-2xl glass-panel text-zinc-400">
                        <div className="flex items-center gap-3">
                          <Loader2 className="w-4 h-4 animate-spin text-teal-500" />
                          <span className="text-sm">جارٍ التفكير...</span>
                          <div className="flex gap-1">
                            <div className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-bounce" style={{ animationDelay: "0s" }}></div>
                            <div className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-bounce" style={{ animationDelay: "0.2s" }}></div>
                            <div className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-bounce" style={{ animationDelay: "0.4s" }}></div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}

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

                {generatedImages.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex gap-4"
                  >
                    <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 bg-teal-500/20 text-teal-400">
                      <ImageIcon className="w-5 h-5" />
                    </div>
                    <div className="flex-1 pr-12">
                      <div className="grid grid-cols-1 gap-4">
                        {generatedImages.map((imgUrl, i) => (
                          <div key={i} className="rounded-2xl overflow-hidden border border-zinc-700/50 shadow-lg">
                            <img src={imgUrl} alt="تصور معماري" className="w-full h-auto" />
                          </div>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        <div className="shrink-0 p-4 md:px-8 md:py-4 glass-panel border-x-0 border-b-0 shadow-[0_-4px_20px_rgba(0,0,0,0.3)] z-30">
          <div className="max-w-4xl mx-auto">
            <form onSubmit={handleFollowup} className="relative flex items-end gap-2">
              <ImageUpload images={followupImages} onImagesChange={setFollowupImages} maxImages={3} compact />
              <div className="relative flex-1">
                <textarea
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="اسأل سؤالاً، اطلب تعديلاً، أو أرفق صورة مرجعية... (Shift+Enter لسطر جديد)"
                  disabled={isAnswering}
                  rows={1}
                  className="w-full bg-zinc-900 border border-zinc-700/80 rounded-2xl pl-16 pr-6 py-4 text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 shadow-xl transition-all disabled:opacity-50 resize-none overflow-hidden"
                  style={{ minHeight: "56px", maxHeight: "150px" }}
                  onInput={(e) => {
                    const target = e.target as HTMLTextAreaElement;
                    target.style.height = "auto";
                    target.style.height = Math.min(target.scrollHeight, 150) + "px";
                  }}
                />
                <button
                  type="submit"
                  disabled={(!question.trim() && followupImages.length === 0) || isAnswering}
                  className="absolute left-3 top-1/2 -translate-y-1/2 p-2 bg-teal-500 hover:bg-teal-400 text-white rounded-xl transition-colors disabled:opacity-50 disabled:hover:bg-teal-500"
                >
                  {isAnswering ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5 rtl:-scale-x-100" />}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
