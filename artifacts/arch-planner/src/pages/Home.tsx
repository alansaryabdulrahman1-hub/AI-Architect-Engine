import { useState } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Building2, Home as HomeIcon, LayoutGrid, Store, Building, Briefcase, Sparkles, Loader2 } from "lucide-react";
import { useGenerateArchitecturePlan } from "@/hooks/use-architecture-stream";
import { type CreateArchitectureSessionBody, type CreateArchitectureSessionBodyBuildingType, CreateArchitectureSessionBodyBuildingType as BuildingTypeEnum } from "@workspace/api-client-react";
import { MarkdownRenderer } from "@/components/MarkdownRenderer";

const BUILDING_TYPES: Array<{ id: CreateArchitectureSessionBodyBuildingType; name: string; icon: React.ElementType; color: string }> = [
  { id: BuildingTypeEnum.villa, name: "فيلا سكنية", icon: HomeIcon, color: "from-teal-400 to-teal-600" },
  { id: BuildingTypeEnum.townhouse, name: "تاون هاوس", icon: LayoutGrid, color: "from-blue-400 to-blue-600" },
  { id: BuildingTypeEnum.apartment, name: "شقة", icon: Building2, color: "from-indigo-400 to-indigo-600" },
  { id: BuildingTypeEnum.offices, name: "مكاتب إدارية", icon: Briefcase, color: "from-purple-400 to-purple-600" },
  { id: BuildingTypeEnum.shop, name: "متجر تجاري", icon: Store, color: "from-pink-400 to-pink-600" },
  { id: BuildingTypeEnum.other, name: "أخرى", icon: Building, color: "from-zinc-400 to-zinc-600" },
];

export default function Home() {
  const [, setLocation] = useLocation();
  const { generate, isGenerating, content } = useGenerateArchitecturePlan();
  
  const [formData, setFormData] = useState<CreateArchitectureSessionBody>({
    buildingType: BuildingTypeEnum.villa,
    buildingSubtype: "",
    area: 300,
    floors: 2,
    additionalRequirements: ""
  });

  const [step, setStep] = useState<"form" | "generating">("form");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStep("generating");
    
    try {
      const { sessionId } = await generate(formData);
      
      if (sessionId != null) {
        setLocation(`/sessions/${sessionId}`);
      }
    } catch (error) {
      console.error(error);
      setStep("form");
      alert("حدث خطأ أثناء توليد المخطط. حاول مرة أخرى.");
    }
  };

  return (
    <div className="min-h-full flex flex-col max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <AnimatePresence mode="wait">
        {step === "form" ? (
          <motion.div 
            key="form"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="flex-1 w-full max-w-3xl mx-auto mt-8"
          >
            <div className="text-center mb-12">
              <div className="inline-flex items-center justify-center p-3 bg-teal-500/10 rounded-2xl mb-4 border border-teal-500/20">
                <Sparkles className="w-8 h-8 text-teal-400" />
              </div>
              <h2 className="text-4xl md:text-5xl font-display font-bold text-white mb-4 tracking-tight">
                ماذا تريد أن تبني <span className="text-gradient">اليوم؟</span>
              </h2>
              <p className="text-lg text-zinc-400 max-w-xl mx-auto">
                أدخل تفاصيل مشروعك وسيقوم الذكاء الاصطناعي بتوليد مخطط معماري تفصيلي مدروس مخصص لاحتياجاتك.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="glass-panel rounded-3xl p-6 md:p-8 space-y-8">
              
              {/* Type Selection */}
              <div>
                <label className="block text-sm font-semibold text-zinc-300 mb-4">نوع المبنى</label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {BUILDING_TYPES.map(type => (
                    <button
                      key={type.id}
                      type="button"
                      onClick={() => setFormData({...formData, buildingType: type.id})}
                      className={`
                        relative flex flex-col items-center justify-center p-4 rounded-2xl border transition-all duration-300 overflow-hidden
                        ${formData.buildingType === type.id 
                          ? 'bg-zinc-800 border-teal-500/50 shadow-[0_0_15px_rgba(20,184,166,0.15)]' 
                          : 'bg-zinc-900/50 border-zinc-800 hover:bg-zinc-800/80 hover:border-zinc-700'}
                      `}
                    >
                      {formData.buildingType === type.id && (
                        <div className={`absolute inset-0 bg-gradient-to-br ${type.color} opacity-5`}></div>
                      )}
                      <type.icon className={`w-6 h-6 mb-3 ${formData.buildingType === type.id ? 'text-teal-400' : 'text-zinc-500'}`} />
                      <span className={`text-sm font-medium ${formData.buildingType === type.id ? 'text-zinc-100' : 'text-zinc-400'}`}>
                        {type.name}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-zinc-300 mb-2">الصنف أو الوصف المختصر</label>
                  <input 
                    type="text" 
                    required
                    value={formData.buildingSubtype}
                    onChange={e => setFormData({...formData, buildingSubtype: e.target.value})}
                    placeholder="مثال: فيلا فاخرة بتصميم مودرن"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500 transition-all"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-zinc-300 mb-2">المساحة (م²)</label>
                    <input 
                      type="number" 
                      required min="10"
                      value={formData.area}
                      onChange={e => setFormData({...formData, area: parseInt(e.target.value) || 0})}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-zinc-300 mb-2">عدد الأدوار</label>
                    <input 
                      type="number" 
                      required min="1" max="100"
                      value={formData.floors}
                      onChange={e => setFormData({...formData, floors: parseInt(e.target.value) || 1})}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500 transition-all"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-zinc-300 mb-2">متطلبات إضافية (اختياري)</label>
                <textarea 
                  value={formData.additionalRequirements}
                  onChange={e => setFormData({...formData, additionalRequirements: e.target.value})}
                  placeholder="مثال: حديقة داخلية، صالة ألعاب رياضية، مسبح خلفي، واجهة زجاجية..."
                  rows={3}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500 transition-all resize-none"
                />
              </div>

              <div className="pt-4">
                <button 
                  type="submit"
                  disabled={isGenerating}
                  className="w-full bg-gradient-to-r from-teal-500 to-indigo-600 hover:from-teal-400 hover:to-indigo-500 text-white font-bold text-lg py-4 rounded-xl shadow-lg shadow-teal-500/25 hover:shadow-teal-500/40 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 flex justify-center items-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Sparkles className="w-5 h-5" />
                  بدء التخطيط المعماري
                </button>
              </div>
            </form>
          </motion.div>
        ) : (
          <motion.div 
            key="generating"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex-1 w-full max-w-4xl mx-auto"
          >
            <div className="flex items-center gap-4 mb-8">
              <div className="relative flex items-center justify-center w-12 h-12 rounded-full bg-teal-500/10 border border-teal-500/20">
                <Loader2 className="w-6 h-6 text-teal-400 animate-spin" />
                <div className="absolute inset-0 rounded-full border border-teal-500/30 animate-ping"></div>
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">جاري إعداد المخطط...</h3>
                <p className="text-zinc-400 text-sm">يقوم الذكاء الاصطناعي بتوزيع المساحات وتحليل المتطلبات</p>
              </div>
            </div>

            <div className="glass-panel rounded-3xl p-6 md:p-8 min-h-[400px]">
              <MarkdownRenderer content={content} />
              
              {isGenerating && (
                <div className="mt-6 flex items-center gap-2 text-zinc-500">
                  <div className="w-2 h-2 rounded-full bg-teal-500 animate-bounce" style={{ animationDelay: "0s" }}></div>
                  <div className="w-2 h-2 rounded-full bg-teal-500 animate-bounce" style={{ animationDelay: "0.2s" }}></div>
                  <div className="w-2 h-2 rounded-full bg-teal-500 animate-bounce" style={{ animationDelay: "0.4s" }}></div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
