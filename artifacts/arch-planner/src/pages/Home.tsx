import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Building2, Home as HomeIcon, LayoutGrid, Store, Building, Briefcase, Sparkles, Loader2, AlertTriangle, Info, ChevronDown, ChevronUp, MapPin, Landmark, Users, CheckCircle2 } from "lucide-react";
import { useGenerateArchitecturePlan } from "@/hooks/use-architecture-stream";
import {
  type CreateArchitectureSessionBody,
  type CreateArchitectureSessionBodyBuildingType,
  CreateArchitectureSessionBodyBuildingType as BuildingTypeEnum,
  CreateArchitectureSessionBodyFloors as FloorsEnum,
  CreateArchitectureSessionBodyAcType as AcTypeEnum,
  CreateArchitectureSessionBodyFacadeDirection as FacadeDirectionEnum,
  CreateArchitectureSessionBodyStairLocation as StairLocationEnum,
  CreateArchitectureSessionBodyKitchenType as KitchenTypeEnum,
  CreateArchitectureSessionBodySoilType as SoilTypeEnum,
  CreateArchitectureSessionBodyBudgetRange as BudgetRangeEnum,
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

const FLOORS_OPTIONS = [
  { value: FloorsEnum.ground_only, label: "أرضي فقط" },
  { value: FloorsEnum.ground_first, label: "أرضي + أول" },
  { value: FloorsEnum.ground_first_annex, label: "أرضي + أول + ملحق" },
];

const FLOORS_COUNT: Record<string, number> = {
  ground_only: 1,
  ground_first: 2,
  ground_first_annex: 3,
};

const AC_TYPE_OPTIONS = [
  { value: AcTypeEnum.split, label: "سبليت" },
  { value: AcTypeEnum.concealed, label: "كونسيلد" },
  { value: AcTypeEnum.central, label: "مركزي" },
];

const FACADE_DIRECTION_OPTIONS = [
  { value: FacadeDirectionEnum.north, label: "شمال" },
  { value: FacadeDirectionEnum.south, label: "جنوب" },
  { value: FacadeDirectionEnum.east, label: "شرق" },
  { value: FacadeDirectionEnum.west, label: "غرب" },
];

const STAIR_LOCATION_OPTIONS = [
  { value: StairLocationEnum.central, label: "مركزية" },
  { value: StairLocationEnum.side, label: "جانبية" },
  { value: StairLocationEnum.back, label: "خلفي" },
];

const KITCHEN_TYPE_OPTIONS = [
  { value: KitchenTypeEnum.open, label: "مفتوح" },
  { value: KitchenTypeEnum.closed, label: "مغلق" },
];

const SOIL_TYPE_OPTIONS = [
  { value: SoilTypeEnum.rocky, label: "صخري" },
  { value: SoilTypeEnum.sandy, label: "رملي" },
  { value: SoilTypeEnum.clay, label: "طيني" },
  { value: SoilTypeEnum.mixed, label: "مختلط" },
];

const BUDGET_RANGE_OPTIONS = [
  { value: BudgetRangeEnum.low, label: "منخفض" },
  { value: BudgetRangeEnum.medium, label: "متوسط" },
  { value: BudgetRangeEnum.high, label: "مرتفع" },
  { value: BudgetRangeEnum.premium, label: "فاخر" },
];

const NEIGHBOR_STATUS_OPTIONS = [
  { value: "built", label: "مبني" },
  { value: "empty", label: "فارغ" },
  { value: "street", label: "شارع" },
  { value: "garden", label: "حديقة" },
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

function isIrregularPlot(
  sideNorth: number | undefined,
  sideSouth: number | undefined,
  sideEast: number | undefined,
  sideWest: number | undefined,
): boolean {
  if (!sideNorth || !sideSouth || !sideEast || !sideWest) return false;
  const nsDiff = Math.abs(sideNorth - sideSouth) / Math.max(sideNorth, sideSouth);
  const ewDiff = Math.abs(sideEast - sideWest) / Math.max(sideEast, sideWest);
  return nsDiff > 0.1 || ewDiff > 0.1;
}

const inputClass = "w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500 transition-all";
const inputErrorClass = "w-full bg-zinc-950 border border-red-500/60 rounded-xl px-4 py-3 text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500 transition-all";
const selectClass = "w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500 transition-all appearance-none cursor-pointer";
const selectErrorClass = "w-full bg-zinc-950 border border-red-500/60 rounded-xl px-4 py-3 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500 transition-all appearance-none cursor-pointer";
const labelClass = "block text-sm font-semibold text-zinc-300 mb-2";
const sectionHeaderClass = "text-sm font-bold text-zinc-400 uppercase tracking-widest mb-4 pb-2 border-b border-zinc-800";
const errorMsgClass = "text-xs text-red-400 mt-1";
const requiredStar = " *";

type ValidationErrors = Record<string, string>;

function CollapsibleSection({ title, icon: Icon, iconColor, children, defaultOpen = false, badge }: {
  title: string;
  icon: React.ElementType;
  iconColor: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  badge?: string;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  return (
    <div className="border border-zinc-800 rounded-2xl overflow-hidden">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-5 py-4 bg-zinc-900/50 hover:bg-zinc-900/80 transition-colors"
      >
        <div className="flex items-center gap-3">
          <Icon className={`w-5 h-5 ${iconColor}`} />
          <span className="text-sm font-bold text-zinc-200">{title}</span>
          {badge && (
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400">{badge}</span>
          )}
        </div>
        {isOpen ? <ChevronUp className="w-4 h-4 text-zinc-500" /> : <ChevronDown className="w-4 h-4 text-zinc-500" />}
      </button>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="p-5 space-y-6">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const GENERATION_PHASES = [
  { label: "تحليل هندسة الأرض...", duration: 3000 },
  { label: "حساب التوزيع المساحي...", duration: 6000 },
  { label: "تصميم المخطط المعماري...", duration: 10000 },
  { label: "إعداد الجداول والإحداثيات...", duration: 18000 },
  { label: "كتابة سكربت AutoCAD...", duration: 25000 },
  { label: "مراجعة القواعد الهندسية...", duration: 35000 },
];

function GeneratingView({
  formData,
  sideNorth,
  sideSouth,
  sideEast,
  sideWest,
  bedroomCount,
  content,
  isGenerating,
}: {
  formData: { buildingType: string; buildingSubtype: string; area: number; floors: string };
  sideNorth: string;
  sideSouth: string;
  sideEast: string;
  sideWest: string;
  bedroomCount: string;
  content: string;
  isGenerating: boolean;
}) {
  const [currentPhase, setCurrentPhase] = useState(0);
  const startTimeRef = useRef(Date.now());

  useEffect(() => {
    if (!isGenerating) return;
    startTimeRef.current = Date.now();

    const interval = setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current;
      let phase = 0;
      for (let i = GENERATION_PHASES.length - 1; i >= 0; i--) {
        if (elapsed >= GENERATION_PHASES[i].duration) {
          phase = i;
          break;
        }
      }
      setCurrentPhase(phase);
    }, 1000);

    return () => clearInterval(interval);
  }, [isGenerating]);

  return (
    <motion.div
      key="generating"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex-1 w-full max-w-4xl mx-auto flex flex-col"
    >
      <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-2xl p-5 mb-6">
        <div className="flex items-center gap-3 mb-3 pb-2 border-b border-indigo-500/10">
          <Building className="w-5 h-5 text-indigo-400" />
          <h4 className="text-sm font-semibold text-indigo-300">ملخص الطلب</h4>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm text-zinc-300">
          <div><span className="text-zinc-500">النوع: </span>{formData.buildingSubtype || formData.buildingType}</div>
          <div><span className="text-zinc-500">المساحة: </span>{formData.area} م²</div>
          <div><span className="text-zinc-500">الأدوار: </span>{formData.floors}</div>
          {sideNorth && <div><span className="text-zinc-500">شمال: </span>{sideNorth} م</div>}
          {sideSouth && <div><span className="text-zinc-500">جنوب: </span>{sideSouth} م</div>}
          {sideEast && <div><span className="text-zinc-500">شرق: </span>{sideEast} م</div>}
          {sideWest && <div><span className="text-zinc-500">غرب: </span>{sideWest} م</div>}
          {bedroomCount && <div><span className="text-zinc-500">غرف النوم: </span>{bedroomCount}</div>}
        </div>
      </div>

      <div className="mb-6 space-y-2">
        {GENERATION_PHASES.map((phase, idx) => {
          const isActive = idx === currentPhase && isGenerating;
          const isComplete = idx < currentPhase || !isGenerating;
          return (
            <motion.div
              key={idx}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: idx <= currentPhase || !isGenerating ? 1 : 0.3, x: 0 }}
              transition={{ delay: idx * 0.05 }}
              className={`flex items-center gap-3 px-4 py-2 rounded-xl text-sm transition-colors ${
                isActive ? 'bg-teal-500/10 border border-teal-500/20 text-teal-300' :
                isComplete ? 'text-zinc-500' : 'text-zinc-600'
              }`}
            >
              {isComplete ? (
                <CheckCircle2 className="w-4 h-4 text-teal-500/60 shrink-0" />
              ) : isActive ? (
                <Loader2 className="w-4 h-4 text-teal-400 animate-spin shrink-0" />
              ) : (
                <div className="w-4 h-4 rounded-full border border-zinc-700 shrink-0" />
              )}
              <span>{phase.label}</span>
            </motion.div>
          );
        })}
      </div>

      <div className="glass-panel rounded-3xl p-6 md:p-8 min-h-[400px] flex-1">
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
  );
}

export default function Home() {
  const [, setLocation] = useLocation();
  const { generate, isGenerating, content } = useGenerateArchitecturePlan();

  const [formData, setFormData] = useState<Partial<CreateArchitectureSessionBody>>({
    buildingType: BuildingTypeEnum.villa,
    buildingSubtype: "",
    area: 300,
    floors: FloorsEnum.ground_first,
    additionalRequirements: "",
  });

  const [sideNorth, setSideNorth] = useState<string>("");
  const [sideSouth, setSideSouth] = useState<string>("");
  const [sideEast, setSideEast] = useState<string>("");
  const [sideWest, setSideWest] = useState<string>("");
  const [isIrregularLand, setIsIrregularLand] = useState(false);
  const [chordLength, setChordLength] = useState<string>("");
  const [setbackFront, setSetbackFront] = useState<string>("");
  const [setbackSide, setSetbackSide] = useState<string>("");
  const [setbackBack, setSetbackBack] = useState<string>("");
  const [bedroomCount, setBedroomCount] = useState<string>("");
  const [groundLevelDiff, setGroundLevelDiff] = useState<string>("");
  const [deedNumber, setDeedNumber] = useState<string>("");
  const [plotNumber, setPlotNumber] = useState<string>("");

  const [images, setImages] = useState<string[]>([]);
  const [step, setStep] = useState<"form" | "generating">("form");
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [submitted, setSubmitted] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const markTouched = (field: string) => {
    setTouched(prev => ({ ...prev, [field]: true }));
  };

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

  const irregular = useMemo(() => isIrregularPlot(parsedSideNorth, parsedSideSouth, parsedSideEast, parsedSideWest),
    [parsedSideNorth, parsedSideSouth, parsedSideEast, parsedSideWest]);

  useEffect(() => {
    if (irregular) setIsIrregularLand(true);
  }, [irregular]);

  const totalProgrammedArea = formData.area || 0;
  const floorsCount = FLOORS_COUNT[formData.floors || "ground_first"] || 2;
  const exceedsArea = netBuildableArea != null && totalProgrammedArea > netBuildableArea * floorsCount;

  const validate = useCallback((): ValidationErrors => {
    const e: ValidationErrors = {};
    if (!formData.buildingSubtype?.trim()) e.buildingSubtype = "هذا الحقل مطلوب";
    if (!formData.area || formData.area < 10) e.area = "أدخل مساحة لا تقل عن 10 م²";
    if (!sideNorth.trim()) e.sideNorth = "هذا الحقل مطلوب";
    if (!sideSouth.trim()) e.sideSouth = "هذا الحقل مطلوب";
    if (!sideEast.trim()) e.sideEast = "هذا الحقل مطلوب";
    if (!sideWest.trim()) e.sideWest = "هذا الحقل مطلوب";
    if (isIrregularLand && !chordLength.trim()) e.chordLength = "هذا الحقل مطلوب للأرض غير المنتظمة";
    if (!setbackFront.trim()) e.setbackFront = "هذا الحقل مطلوب";
    if (!setbackSide.trim()) e.setbackSide = "هذا الحقل مطلوب";
    if (!setbackBack.trim()) e.setbackBack = "هذا الحقل مطلوب";
    if (exceedsArea) e._area = "المساحة المطلوبة تتجاوز المساحة القابلة للبناء. قلّل المساحة أو زِد عدد الأدوار.";
    return e;
  }, [formData, sideNorth, sideSouth, sideEast, sideWest, chordLength, setbackFront, setbackSide, setbackBack, groundLevelDiff, exceedsArea, isIrregularLand]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    const validationErrors = validate();
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;

    setStep("generating");

    try {
      const payload: CreateArchitectureSessionBody = {
        buildingType: formData.buildingType || BuildingTypeEnum.villa,
        buildingSubtype: formData.buildingSubtype || "",
        area: formData.area || 300,
        floors: formData.floors || FloorsEnum.ground_first,
        sideNorth: parseFloat(sideNorth),
        sideSouth: parseFloat(sideSouth),
        sideEast: parseFloat(sideEast),
        sideWest: parseFloat(sideWest),
        isIrregularLand,
        chordLength: chordLength ? parseFloat(chordLength) : undefined,
        setbackFront: parseFloat(setbackFront),
        setbackSide: parseFloat(setbackSide),
        setbackBack: parseFloat(setbackBack),
        additionalRequirements: formData.additionalRequirements || undefined,
      };

      if (deedNumber.trim()) payload.deedNumber = deedNumber.trim();
      if (plotNumber.trim()) payload.plotNumber = plotNumber.trim();
      if (formData.neighborEast) {
        payload.neighborEast = formData.neighborEast;
        if (formData.neighborEast === "built" && formData.neighborEastWindows) payload.neighborEastWindows = formData.neighborEastWindows;
      }
      if (formData.neighborWest) {
        payload.neighborWest = formData.neighborWest;
        if (formData.neighborWest === "built" && formData.neighborWestWindows) payload.neighborWestWindows = formData.neighborWestWindows;
      }
      if (formData.neighborSouth) {
        payload.neighborSouth = formData.neighborSouth;
        if (formData.neighborSouth === "built" && formData.neighborSouthWindows) payload.neighborSouthWindows = formData.neighborSouthWindows;
      }
      if (formData.soilType) payload.soilType = formData.soilType;
      if (formData.budgetRange) payload.budgetRange = formData.budgetRange;
      if (formData.facadeDirection) payload.facadeDirection = formData.facadeDirection;
      if (groundLevelDiff.trim()) payload.groundLevelDifference = parseFloat(groundLevelDiff);
      if (formData.acType) payload.acType = formData.acType;
      if (formData.stairLocation) payload.stairLocation = formData.stairLocation;
      if (bedroomCount.trim()) payload.bedroomCount = parseInt(bedroomCount);
      if (formData.kitchenType) payload.kitchenType = formData.kitchenType;

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

  useEffect(() => {
    if (submitted || Object.keys(touched).length > 0) {
      setErrors(validate());
    }
  }, [formData, sideNorth, sideSouth, sideEast, sideWest, chordLength, setbackFront, setbackSide, setbackBack, bedroomCount, groundLevelDiff, exceedsArea, submitted, touched, isIrregularLand]);

  const showError = (field: string) => (submitted || touched[field]) && errors[field];

  const blurHandler = (field: string) => () => markTouched(field);

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

            <form onSubmit={handleSubmit} className="glass-panel rounded-3xl p-6 md:p-8 space-y-6" noValidate>

              <CollapsibleSection title="الهندسة الأساسية (إجباري)" icon={Building2} iconColor="text-teal-400" defaultOpen={true} badge="مطلوب">
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
                    <label className={labelClass}>الصنف أو الوصف المختصر{requiredStar}</label>
                    <input
                      type="text"
                      value={formData.buildingSubtype || ""}
                      onChange={e => setFormData({ ...formData, buildingSubtype: e.target.value })}
                      onBlur={blurHandler("buildingSubtype")}
                      placeholder="مثال: فيلا فاخرة بتصميم مودرن"
                      className={showError("buildingSubtype") ? inputErrorClass : inputClass}
                    />
                    {showError("buildingSubtype") && <p className={errorMsgClass}>{errors.buildingSubtype}</p>}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={labelClass}>المساحة الإجمالية (م²){requiredStar}</label>
                      <input
                        type="number"
                        min="10"
                        value={formData.area || ""}
                        onChange={e => setFormData({ ...formData, area: parseFloat(e.target.value) || 0 })}
                        onBlur={blurHandler("area")}
                        className={showError("area") ? inputErrorClass : inputClass}
                      />
                      {showError("area") && <p className={errorMsgClass}>{errors.area}</p>}
                    </div>
                    <div>
                      <label className={labelClass}>عدد الأدوار{requiredStar}</label>
                      <select
                        value={formData.floors || FloorsEnum.ground_first}
                        onChange={e => setFormData({ ...formData, floors: e.target.value as CreateArchitectureSessionBody["floors"] })}
                        className={selectClass}
                      >
                        {FLOORS_OPTIONS.map(opt => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                <div>
                  <p className={sectionHeaderClass}>أبعاد الأرض{requiredStar}</p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    <div>
                      <label className={labelClass}>الضلع الشمالي (م){requiredStar}</label>
                      <input type="number" min="0" step="0.1" value={sideNorth}
                        onChange={e => setSideNorth(e.target.value)}
                        onBlur={blurHandler("sideNorth")}
                        placeholder="0.0" className={showError("sideNorth") ? inputErrorClass : inputClass} />
                      {showError("sideNorth") && <p className={errorMsgClass}>{errors.sideNorth}</p>}
                    </div>
                    <div>
                      <label className={labelClass}>الضلع الجنوبي (م){requiredStar}</label>
                      <input type="number" min="0" step="0.1" value={sideSouth}
                        onChange={e => setSideSouth(e.target.value)}
                        onBlur={blurHandler("sideSouth")}
                        placeholder="0.0" className={showError("sideSouth") ? inputErrorClass : inputClass} />
                      {showError("sideSouth") && <p className={errorMsgClass}>{errors.sideSouth}</p>}
                    </div>
                    <div>
                      <label className={labelClass}>الضلع الشرقي (م){requiredStar}</label>
                      <input type="number" min="0" step="0.1" value={sideEast}
                        onChange={e => setSideEast(e.target.value)}
                        onBlur={blurHandler("sideEast")}
                        placeholder="0.0" className={showError("sideEast") ? inputErrorClass : inputClass} />
                      {showError("sideEast") && <p className={errorMsgClass}>{errors.sideEast}</p>}
                    </div>
                    <div>
                      <label className={labelClass}>الضلع الغربي (م){requiredStar}</label>
                      <input type="number" min="0" step="0.1" value={sideWest}
                        onChange={e => setSideWest(e.target.value)}
                        onBlur={blurHandler("sideWest")}
                        placeholder="0.0" className={showError("sideWest") ? inputErrorClass : inputClass} />
                      {showError("sideWest") && <p className={errorMsgClass}>{errors.sideWest}</p>}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 mb-4">
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isIrregularLand}
                        onChange={e => setIsIrregularLand(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-zinc-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-teal-500/50 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-600"></div>
                    </label>
                    <span className="text-sm text-zinc-300">أرض غير منتظمة (زوايا غير قائمة)</span>
                  </div>

                  {isIrregularLand && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="mb-4"
                    >
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className={labelClass}>الوتر الرئيسي (م){requiredStar} <span className="text-zinc-500 font-normal">— لضبط زوايا الأرض المتعرجة</span></label>
                          <input type="number" min="0" step="0.1" value={chordLength}
                            onChange={e => setChordLength(e.target.value)}
                            onBlur={blurHandler("chordLength")}
                            placeholder="0.0" className={showError("chordLength") ? inputErrorClass : inputClass} />
                          {showError("chordLength") && <p className={errorMsgClass}>{errors.chordLength}</p>}
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {irregular && (
                    <div className="mt-4 flex items-start gap-3 px-4 py-3 rounded-xl bg-blue-500/10 border border-blue-500/30">
                      <Info className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-blue-300 font-semibold text-sm">تنبيه: أرض غير منتظمة</p>
                        <p className="text-zinc-400 text-xs mt-1">
                          الأبعاد تشير إلى أرض غير مستطيلة. سيوجّه المحرك التصميمي غرف الخدمات (المناور، دورات المياه، المخازن) نحو الزوايا المشطورة لضمان انتظام غرف المعيشة.
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <p className={sectionHeaderClass}>الارتدادات النظامية{requiredStar}</p>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className={labelClass}>أمامي - جهة الشارع (م){requiredStar}</label>
                      <input type="number" min="0" step="0.1" value={setbackFront}
                        onChange={e => setSetbackFront(e.target.value)}
                        onBlur={blurHandler("setbackFront")}
                        placeholder="0.0" className={showError("setbackFront") ? inputErrorClass : inputClass} />
                      {showError("setbackFront") && <p className={errorMsgClass}>{errors.setbackFront}</p>}
                    </div>
                    <div>
                      <label className={labelClass}>جانبي - جهة الجيران (م){requiredStar}</label>
                      <input type="number" min="0" step="0.1" value={setbackSide}
                        onChange={e => setSetbackSide(e.target.value)}
                        onBlur={blurHandler("setbackSide")}
                        placeholder="0.0" className={showError("setbackSide") ? inputErrorClass : inputClass} />
                      {showError("setbackSide") && <p className={errorMsgClass}>{errors.setbackSide}</p>}
                    </div>
                    <div>
                      <label className={labelClass}>خلفي (م){requiredStar}</label>
                      <input type="number" min="0" step="0.1" value={setbackBack}
                        onChange={e => setSetbackBack(e.target.value)}
                        onBlur={blurHandler("setbackBack")}
                        placeholder="0.0" className={showError("setbackBack") ? inputErrorClass : inputClass} />
                      {showError("setbackBack") && <p className={errorMsgClass}>{errors.setbackBack}</p>}
                    </div>
                  </div>

                  {netBuildableArea != null && (
                    <div className="mt-4 flex items-center gap-3 px-4 py-3 rounded-xl bg-teal-500/10 border border-teal-500/20">
                      <span className="text-sm text-zinc-300">صافي مساحة البناء المسموحة للدور الواحد:</span>
                      <span className="text-teal-300 font-bold text-lg">{netBuildableArea.toFixed(1)} م²</span>
                      <span className="text-zinc-500 text-sm">× {floorsCount} أدوار = {(netBuildableArea * floorsCount).toFixed(1)} م²</span>
                    </div>
                  )}

                  {exceedsArea && (
                    <div className="mt-3 flex items-start gap-3 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/30">
                      <AlertTriangle className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-red-300 font-semibold text-sm">خطأ: البرنامج يتجاوز المساحة القابلة للبناء</p>
                        <p className="text-zinc-400 text-xs mt-1">
                          المساحة المُدخلة ({totalProgrammedArea} م²) أكبر من المساحة القابلة للبناء في {floorsCount} {floorsCount === 1 ? "دور" : "أدوار"} ({(netBuildableArea! * floorsCount).toFixed(1)} م²).
                          يجب تقليل مساحات الغرف أو زيادة عدد الأدوار قبل المتابعة.
                        </p>
                      </div>
                    </div>
                  )}
                </div>

              </CollapsibleSection>

              <CollapsibleSection title="سياق الموقع والبيئة" icon={MapPin} iconColor="text-blue-400" badge="جديد">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>رقم الصك</label>
                    <input type="text" value={deedNumber}
                      onChange={e => setDeedNumber(e.target.value)}
                      placeholder="رقم صك الملكية"
                      className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>رقم القطعة</label>
                    <input type="text" value={plotNumber}
                      onChange={e => setPlotNumber(e.target.value)}
                      placeholder="رقم القطعة"
                      className={inputClass} />
                  </div>
                </div>

                <div>
                  <p className={sectionHeaderClass}>حالة الجيران</p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className={labelClass}>الجار الشرقي</label>
                      <select
                        value={formData.neighborEast ?? ""}
                        onChange={e => setFormData({ ...formData, neighborEast: e.target.value || undefined, neighborEastWindows: e.target.value === "built" ? formData.neighborEastWindows : undefined })}
                        className={selectClass}
                      >
                        <option value="">— غير محدد —</option>
                        {NEIGHBOR_STATUS_OPTIONS.map(opt => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                      {formData.neighborEast === "built" && (
                        <input type="text" value={formData.neighborEastWindows ?? ""}
                          onChange={e => setFormData({ ...formData, neighborEastWindows: e.target.value || undefined })}
                          placeholder="مواقع نوافذ/فتحات الجار (مثال: الدور الأول - 3 نوافذ)"
                          className={`${inputClass} mt-2`} />
                      )}
                    </div>
                    <div>
                      <label className={labelClass}>الجار الغربي</label>
                      <select
                        value={formData.neighborWest ?? ""}
                        onChange={e => setFormData({ ...formData, neighborWest: e.target.value || undefined, neighborWestWindows: e.target.value === "built" ? formData.neighborWestWindows : undefined })}
                        className={selectClass}
                      >
                        <option value="">— غير محدد —</option>
                        {NEIGHBOR_STATUS_OPTIONS.map(opt => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                      {formData.neighborWest === "built" && (
                        <input type="text" value={formData.neighborWestWindows ?? ""}
                          onChange={e => setFormData({ ...formData, neighborWestWindows: e.target.value || undefined })}
                          placeholder="مواقع نوافذ/فتحات الجار (مثال: الدور الأول - 3 نوافذ)"
                          className={`${inputClass} mt-2`} />
                      )}
                    </div>
                    <div>
                      <label className={labelClass}>الجار الجنوبي</label>
                      <select
                        value={formData.neighborSouth ?? ""}
                        onChange={e => setFormData({ ...formData, neighborSouth: e.target.value || undefined, neighborSouthWindows: e.target.value === "built" ? formData.neighborSouthWindows : undefined })}
                        className={selectClass}
                      >
                        <option value="">— غير محدد —</option>
                        {NEIGHBOR_STATUS_OPTIONS.map(opt => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                      {formData.neighborSouth === "built" && (
                        <input type="text" value={formData.neighborSouthWindows ?? ""}
                          onChange={e => setFormData({ ...formData, neighborSouthWindows: e.target.value || undefined })}
                          placeholder="مواقع نوافذ/فتحات الجار (مثال: الدور الأول - 3 نوافذ)"
                          className={`${inputClass} mt-2`} />
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>نوع التربة</label>
                    <select
                      value={formData.soilType ?? ""}
                      onChange={e => setFormData({ ...formData, soilType: (e.target.value as CreateArchitectureSessionBody["soilType"]) || undefined })}
                      className={selectClass}
                    >
                      <option value="">— غير محدد —</option>
                      {SOIL_TYPE_OPTIONS.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>نطاق الميزانية</label>
                    <select
                      value={formData.budgetRange ?? ""}
                      onChange={e => setFormData({ ...formData, budgetRange: (e.target.value as CreateArchitectureSessionBody["budgetRange"]) || undefined })}
                      className={selectClass}
                    >
                      <option value="">— غير محدد —</option>
                      {BUDGET_RANGE_OPTIONS.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </CollapsibleSection>

              <CollapsibleSection title="التفضيلات التصميمية" icon={Landmark} iconColor="text-purple-400" badge="اختياري">
                <p className="text-xs text-zinc-500 -mt-2 mb-4">عند تركها فارغة، سيقوم الذكاء الاصطناعي باقتراح القيم المثلى بناءً على بيانات الأرض والميزانية.</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>اتجاه الواجهة</label>
                    <select
                      value={formData.facadeDirection ?? ""}
                      onChange={e => setFormData({ ...formData, facadeDirection: e.target.value as CreateArchitectureSessionBody["facadeDirection"] || undefined })}
                      className={selectClass}
                    >
                      <option value="">— يُحدد تلقائياً —</option>
                      {FACADE_DIRECTION_OPTIONS.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>فارق المنسوب عن الشارع (سم)</label>
                    <input type="number" step="1" value={groundLevelDiff}
                      onChange={e => setGroundLevelDiff(e.target.value)}
                      placeholder="مثال: 30 — يُقدّر تلقائياً إن لم يُحدد"
                      className={inputClass} />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className={labelClass}>عدد غرف النوم</label>
                    <input type="number" min="1" step="1" value={bedroomCount}
                      onChange={e => setBedroomCount(e.target.value)}
                      placeholder="يُحدد تلقائياً"
                      className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>نوع المطبخ</label>
                    <select
                      value={formData.kitchenType ?? ""}
                      onChange={e => setFormData({ ...formData, kitchenType: (e.target.value as CreateArchitectureSessionBody["kitchenType"]) || undefined })}
                      className={selectClass}
                    >
                      <option value="">— يُحدد تلقائياً —</option>
                      {KITCHEN_TYPE_OPTIONS.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>موقع الدرج والمصعد</label>
                    <select
                      value={formData.stairLocation ?? ""}
                      onChange={e => setFormData({ ...formData, stairLocation: (e.target.value as CreateArchitectureSessionBody["stairLocation"]) || undefined })}
                      className={selectClass}
                    >
                      <option value="">— يُحدد تلقائياً —</option>
                      {STAIR_LOCATION_OPTIONS.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>نظام التكييف</label>
                    <select
                      value={formData.acType ?? ""}
                      onChange={e => setFormData({ ...formData, acType: (e.target.value as CreateArchitectureSessionBody["acType"]) || undefined })}
                      className={selectClass}
                    >
                      <option value="">— يُحدد تلقائياً —</option>
                      {AC_TYPE_OPTIONS.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </CollapsibleSection>

              <div>
                <label className={labelClass}>متطلبات إضافية (اختياري)</label>
                <textarea
                  value={formData.additionalRequirements || ""}
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

              {submitted && Object.keys(errors).length > 0 && (
                <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/30">
                  <AlertTriangle className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
                  <p className="text-red-300 text-sm font-semibold">يرجى تعبئة جميع الحقول المطلوبة (*) قبل بدء التصميم.</p>
                </div>
              )}

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
          <GeneratingView
            formData={formData}
            sideNorth={sideNorth}
            sideSouth={sideSouth}
            sideEast={sideEast}
            sideWest={sideWest}
            bedroomCount={bedroomCount}
            content={content}
            isGenerating={isGenerating}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
