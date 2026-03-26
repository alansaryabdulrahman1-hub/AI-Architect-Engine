import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Building2, Home as HomeIcon, LayoutGrid, Store, Building, Briefcase, Sparkles, Loader2, AlertTriangle } from "lucide-react";
import { useGenerateArchitecturePlan } from "@/hooks/use-architecture-stream";
import {
  type CreateArchitectureSessionBody,
  type CreateArchitectureSessionBodyBuildingType,
  CreateArchitectureSessionBodyBuildingType as BuildingTypeEnum,
  CreateArchitectureSessionBodyFloors as FloorsEnum,
  CreateArchitectureSessionBodyAcType as AcTypeEnum,
  CreateArchitectureSessionBodyFacadeDirection as FacadeDirectionEnum,
  CreateArchitectureSessionBodyStairLocation as StairLocationEnum,
} from "@workspace/api-client-react";
import { MarkdownRenderer } from "@/components/MarkdownRenderer";
import { ImageUpload } from "@/components/ImageUpload";

const BUILDING_TYPES: Array<{ id: CreateArchitectureSessionBodyBuildingType; name: string; icon: React.ElementType; color: string }> = [
  { id: BuildingTypeEnum.villa, name: "فيلا سكنية", icon: HomeIcon, color: "from-teal-400 to-teal-600" },
  { id: BuildingTypeEnum.townhouse, name: "تاون هاوس", icon: LayoutGrid, color: "from-blue-400 to-blue-600" },
  { id: BuildingTypeEnum.apartment, name: "شقة", icon: Building2, color: "from-indigo-400 to-indigo-600" },
  { id: BuildingTypeEnum.offices, name: "مكاتب إدارية", icon: Briefcase, color: "from-purple-400 to-purple-600" },
  { id: BuildingTypeEnum.shop, name: "متجر تجاري", icon: Store, color: "from-pink-400 to-pink-600" },
  { id: BuildingTypeEnum.other, name: "أخرى", icon: Building, color: "from-zinc-400 to-zinc-600" },
];

const FLOORS_OPTIONS = Array.from({ length: 20 }, (_, i) => i + 1) as Array<typeof FloorsEnum[keyof typeof FloorsEnum]>;

const AC_TYPE_OPTIONS = [
  { value: AcTypeEnum.central, label: "مركزي (Central)" },
  { value: AcTypeEnum.split, label: "سبليت (Split Units)" },
  { value: AcTypeEnum.vrf, label: "VRF" },
];

const FACADE_DIRECTION_OPTIONS = [
  { value: FacadeDirectionEnum.north, label: "شمال" },
  { value: FacadeDirectionEnum.northeast, label: "شمال شرق" },
  { value: FacadeDirectionEnum.east, label: "شرق" },
  { value: FacadeDirectionEnum.southeast, label: "جنوب شرق" },
  { value: FacadeDirectionEnum.south, label: "جنوب" },
  { value: FacadeDirectionEnum.southwest, label: "جنوب غرب" },
  { value: FacadeDirectionEnum.west, label: "غرب" },
  { value: FacadeDirectionEnum.northwest, label: "شمال غرب" },
];

const STAIR_LOCATION_OPTIONS = [
  { value: StairLocationEnum.central, label: "مركزية" },
  { value: StairLocationEnum.side, label: "جانبية" },
  { value: StairLocationEnum.external, label: "خارجية" },
];

function computeNetBuildableArea(
  sideNorth: number | undefined,
  sideSouth: number | undefined,
  sideEast: number | undefined,
  sideWest: number | undefined,
  setbackFront: number | undefined,
  setbackSide: number | undefined,
  setbackBack: number | undefined,
): number | null {
  if (!sideNorth || !sideSouth || !sideEast || !sideWest) return null;
  const avgWidth = (sideNorth + sideSouth) / 2;
  const avgDepth = (sideEast + sideWest) / 2;
  const front = setbackFront ?? 0;
  const sideTotal = (setbackSide ?? 0) * 2;
  const back = setbackBack ?? 0;
  const buildableWidth = Math.max(0, avgWidth - sideTotal);
  const buildableDepth = Math.max(0, avgDepth - front - back);
  return buildableWidth * buildableDepth;
}

const inputClass = "w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500 transition-all";
const selectClass = "w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500 transition-all appearance-none cursor-pointer";
const labelClass = "block text-sm font-semibold text-zinc-300 mb-2";
const sectionHeaderClass = "text-sm font-bold text-zinc-400 uppercase tracking-widest mb-4 pb-2 border-b border-zinc-800";

export default function Home() {
  const [, setLocation] = useLocation();
  const { generate, isGenerating, content } = useGenerateArchitecturePlan();

  const [formData, setFormData] = useState<CreateArchitectureSessionBody>({
    buildingType: BuildingTypeEnum.villa,
    buildingSubtype: "",
    area: 300,
    floors: FloorsEnum.NUMBER_2,
    additionalRequirements: ""
  });

  const [sideNorth, setSideNorth] = useState<string>("");
  const [sideSouth, setSideSouth] = useState<string>("");
  const [sideEast, setSideEast] = useState<string>("");
  const [sideWest, setSideWest] = useState<string>("");
  const [chordLength, setChordLength] = useState<string>("");
  const [setbackFront, setSetbackFront] = useState<string>("");
  const [setbackSide, setSetbackSide] = useState<string>("");
  const [setbackBack, setSetbackBack] = useState<string>("");

  const [images, setImages] = useState<string[]>([]);
  const [step, setStep] = useState<"form" | "generating">("form");

  const parsedSideNorth = sideNorth ? parseFloat(sideNorth) : undefined;
  const parsedSideSouth = sideSouth ? parseFloat(sideSouth) : undefined;
  const parsedSideEast = sideEast ? parseFloat(sideEast) : undefined;
  const parsedSideWest = sideWest ? parseFloat(sideWest) : undefined;
  const parsedSetbackFront = setbackFront ? parseFloat(setbackFront) : undefined;
  const parsedSetbackSide = setbackSide ? parseFloat(setbackSide) : undefined;
  const parsedSetbackBack = setbackBack ? parseFloat(setbackBack) : undefined;

  const netBuildableArea = useMemo(() => computeNetBuildableArea(
    parsedSideNorth, parsedSideSouth, parsedSideEast, parsedSideWest,
    parsedSetbackFront, parsedSetbackSide, parsedSetbackBack
  ), [parsedSideNorth, parsedSideSouth, parsedSideEast, parsedSideWest, parsedSetbackFront, parsedSetbackSide, parsedSetbackBack]);

  const totalProgrammedArea = formData.area;
  const floorsCount = formData.floors as number;
  const exceedsArea = netBuildableArea != null && totalProgrammedArea > netBuildableArea * floorsCount;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStep("generating");

    try {
      const payload: CreateArchitectureSessionBody = {
        ...formData,
        ...(parsedSideNorth !== undefined ? { sideNorth: parsedSideNorth } : {}),
        ...(parsedSideSouth !== undefined ? { sideSouth: parsedSideSouth } : {}),
        ...(parsedSideEast !== undefined ? { sideEast: parsedSideEast } : {}),
        ...(parsedSideWest !== undefined ? { sideWest: parsedSideWest } : {}),
        ...(chordLength ? { chordLength: parseFloat(chordLength) } : {}),
        ...(parsedSetbackFront !== undefined ? { setbackFront: parsedSetbackFront } : {}),
        ...(parsedSetbackSide !== undefined ? { setbackSide: parsedSetbackSide } : {}),
        ...(parsedSetbackBack !== undefined ? { setbackBack: parsedSetbackBack } : {}),
      };
      if (images.length > 0) {
        payload.images = images;
      }

      const { sessionId } = await generate(payload);

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
                أدخل تفاصيل مشروعك وسيقوم الذكاء الاصطناعي بتوليد مخطط معماري تفصيلي مع أبعاد دقيقة وسكربت AutoLISP جاهز.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="glass-panel rounded-3xl p-6 md:p-8 space-y-8">

              <div>
                <p className={sectionHeaderClass}>نوع المبنى</p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {BUILDING_TYPES.map(type => (
                    <button
                      key={type.id}
                      type="button"
                      onClick={() => setFormData({ ...formData, buildingType: type.id })}
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
                  <label className={labelClass}>الصنف أو الوصف المختصر</label>
                  <input
                    type="text"
                    required
                    value={formData.buildingSubtype}
                    onChange={e => setFormData({ ...formData, buildingSubtype: e.target.value })}
                    placeholder="مثال: فيلا فاخرة بتصميم مودرن"
                    className={inputClass}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>المساحة الإجمالية (م²)</label>
                    <input
                      type="number"
                      required min="10"
                      value={formData.area}
                      onChange={e => setFormData({ ...formData, area: parseFloat(e.target.value) || 0 })}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>عدد الأدوار</label>
                    <select
                      value={formData.floors as number}
                      onChange={e => setFormData({ ...formData, floors: parseInt(e.target.value) as typeof FloorsEnum[keyof typeof FloorsEnum] })}
                      className={selectClass}
                    >
                      {FLOORS_OPTIONS.map(n => (
                        <option key={n} value={n}>{n} {n === 1 ? "دور" : "أدوار"}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div>
                <p className={sectionHeaderClass}>أبعاد القطعة (اختياري)</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div>
                    <label className={labelClass}>الجهة الشمالية (م)</label>
                    <input type="number" min="0" step="0.1" value={sideNorth}
                      onChange={e => setSideNorth(e.target.value)}
                      placeholder="0.0" className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>الجهة الجنوبية (م)</label>
                    <input type="number" min="0" step="0.1" value={sideSouth}
                      onChange={e => setSideSouth(e.target.value)}
                      placeholder="0.0" className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>الجهة الشرقية (م)</label>
                    <input type="number" min="0" step="0.1" value={sideEast}
                      onChange={e => setSideEast(e.target.value)}
                      placeholder="0.0" className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>الجهة الغربية (م)</label>
                    <input type="number" min="0" step="0.1" value={sideWest}
                      onChange={e => setSideWest(e.target.value)}
                      placeholder="0.0" className={inputClass} />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>وتر/قطر تصحيح الزاوية (م) <span className="text-zinc-500 font-normal">— للزوايا غير قائمة</span></label>
                    <input type="number" min="0" step="0.1" value={chordLength}
                      onChange={e => setChordLength(e.target.value)}
                      placeholder="0.0" className={inputClass} />
                  </div>
                </div>
              </div>

              <div>
                <p className={sectionHeaderClass}>الإيقاعات والفراغات التنظيمية (اختياري)</p>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className={labelClass}>أمامي (م)</label>
                    <input type="number" min="0" step="0.1" value={setbackFront}
                      onChange={e => setSetbackFront(e.target.value)}
                      placeholder="0.0" className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>جانبي (م)</label>
                    <input type="number" min="0" step="0.1" value={setbackSide}
                      onChange={e => setSetbackSide(e.target.value)}
                      placeholder="0.0" className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>خلفي (م)</label>
                    <input type="number" min="0" step="0.1" value={setbackBack}
                      onChange={e => setSetbackBack(e.target.value)}
                      placeholder="0.0" className={inputClass} />
                  </div>
                </div>

                {netBuildableArea != null && (
                  <div className="mt-4 flex items-center gap-3 px-4 py-3 rounded-xl bg-teal-500/10 border border-teal-500/20">
                    <span className="text-sm text-zinc-300">صافي المساحة القابلة للبناء للدور الواحد:</span>
                    <span className="text-teal-300 font-bold text-lg">{netBuildableArea.toFixed(1)} م²</span>
                    <span className="text-zinc-500 text-sm">× {floorsCount} أدوار = {(netBuildableArea * floorsCount).toFixed(1)} م²</span>
                  </div>
                )}

                {exceedsArea && (
                  <div className="mt-3 flex items-start gap-3 px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/30">
                    <AlertTriangle className="w-5 h-5 text-amber-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-amber-300 font-semibold text-sm">تحذير: البرنامج يتجاوز المساحة القابلة للبناء</p>
                      <p className="text-zinc-400 text-xs mt-1">
                        المساحة المُدخلة ({totalProgrammedArea} م²) أكبر من المساحة القابلة للبناء في {floorsCount} {floorsCount === 1 ? "دور" : "أدوار"} ({(netBuildableArea * floorsCount).toFixed(1)} م²).
                        يُقترح تقليل مساحات الغرف أو زيادة عدد الأدوار.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <p className={sectionHeaderClass}>تفاصيل الموقع والتصميم (اختياري)</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className={labelClass}>نظام التكييف</label>
                    <select
                      value={formData.acType ?? ""}
                      onChange={e => setFormData({ ...formData, acType: (e.target.value as typeof AcTypeEnum[keyof typeof AcTypeEnum]) || undefined })}
                      className={selectClass}
                    >
                      <option value="">— اختر —</option>
                      {AC_TYPE_OPTIONS.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>اتجاه الواجهة الرئيسية</label>
                    <select
                      value={formData.facadeDirection ?? ""}
                      onChange={e => setFormData({ ...formData, facadeDirection: e.target.value as typeof FacadeDirectionEnum[keyof typeof FacadeDirectionEnum] || undefined })}
                      className={selectClass}
                    >
                      <option value="">— اختر —</option>
                      {FACADE_DIRECTION_OPTIONS.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>موقع الدرج</label>
                    <select
                      value={formData.stairLocation ?? ""}
                      onChange={e => setFormData({ ...formData, stairLocation: e.target.value as typeof StairLocationEnum[keyof typeof StairLocationEnum] || undefined })}
                      className={selectClass}
                    >
                      <option value="">— اختر —</option>
                      {STAIR_LOCATION_OPTIONS.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div>
                <label className={labelClass}>متطلبات إضافية (اختياري)</label>
                <textarea
                  value={formData.additionalRequirements}
                  onChange={e => setFormData({ ...formData, additionalRequirements: e.target.value })}
                  placeholder="مثال: حديقة داخلية، صالة ألعاب رياضية، مسبح خلفي، واجهة زجاجية..."
                  rows={3}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500 transition-all resize-none"
                />
              </div>

              <div>
                <label className={labelClass}>صور مرجعية (اختياري)</label>
                <p className="text-xs text-zinc-500 mb-3">أرفق رسومات يدوية، صور الموقع، أو مراجع تصميمية — سيحللها الذكاء الاصطناعي ويأخذها في الاعتبار</p>
                <ImageUpload images={images} onImagesChange={setImages} maxImages={5} />
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
                <p className="text-zinc-400 text-sm">يقوم الذكاء الاصطناعي بتوزيع المساحات وتحليل المتطلبات وإعداد سكربت AutoCAD</p>
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
