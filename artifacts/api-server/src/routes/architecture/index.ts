import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { conversations, messages, architectureSessions } from "@workspace/db";
import { openai } from "@workspace/integrations-openai-ai-server";
import {
  CreateArchitectureSessionBody,
  SendArchitectureFollowupBody,
} from "@workspace/api-zod";
import { eq } from "drizzle-orm";
import Drawing from "dxf-writer";
type ContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string; detail?: "auto" | "low" | "high" } };

const router: IRouter = Router();

const BUILDING_TYPE_LABELS: Record<string, string> = {
  villa: "فيلا (Villa)",
  townhouse: "تاون هاوس (Townhouse)",
  apartment: "شقة (Apartment)",
  offices: "مكاتب إدارية (Administrative Offices)",
  shop: "متجر (Shop/Retail)",
  other: "مبنى آخر (Other)",
};

const AC_TYPE_LABELS: Record<string, string> = {
  central: "مركزي (Central)",
  split: "سبليت (Split Units)",
  concealed: "كونسيلد (Concealed)",
};

const FACADE_DIRECTION_LABELS: Record<string, string> = {
  north: "شمال (North)",
  south: "جنوب (South)",
  east: "شرق (East)",
  west: "غرب (West)",
};

const STAIR_LOCATION_LABELS: Record<string, string> = {
  central: "مركزية (Central)",
  side: "جانبية (Side)",
  back: "خلفي (Back)",
};

const FLOORS_LABELS: Record<string, string> = {
  ground_only: "أرضي فقط (Ground Only)",
  ground_first: "أرضي + أول (Ground + First)",
  ground_first_annex: "أرضي + أول + ملحق (Ground + First + Annex)",
};

const FLOORS_COUNT: Record<string, number> = {
  ground_only: 1,
  ground_first: 2,
  ground_first_annex: 3,
};

const KITCHEN_TYPE_LABELS: Record<string, string> = {
  open: "مفتوح (Open)",
  closed: "مغلق (Closed)",
};

function computeNetBuildableArea(params: {
  sideNorth?: number | null;
  sideSouth?: number | null;
  sideEast?: number | null;
  sideWest?: number | null;
  chordLength?: number | null;
  setbackFront?: number | null;
  setbackSide?: number | null;
  setbackBack?: number | null;
}): number | null {
  const { sideNorth, sideSouth, sideEast, sideWest, setbackFront, setbackSide, setbackBack } = params;
  if (!sideNorth || !sideSouth || !sideEast || !sideWest) return null;
  const avgWidth = (sideNorth + sideSouth) / 2;
  const avgDepth = (sideEast + sideWest) / 2;
  const frontSetback = setbackFront ?? 0;
  const sideSetbackTotal = (setbackSide ?? 0) * 2;
  const backSetback = setbackBack ?? 0;
  const buildableWidth = Math.max(0, avgWidth - sideSetbackTotal);
  const buildableDepth = Math.max(0, avgDepth - frontSetback - backSetback);
  return buildableWidth * buildableDepth;
}

function buildArchitecturePrompt(
  buildingType: string,
  buildingSubtype: string,
  area: number,
  floors: string,
  options: {
    additionalRequirements?: string | null;
    hasImages?: boolean;
    sideNorth?: number | null;
    sideSouth?: number | null;
    sideEast?: number | null;
    sideWest?: number | null;
    chordLength?: number | null;
    setbackFront?: number | null;
    setbackSide?: number | null;
    setbackBack?: number | null;
    acType?: string | null;
    facadeDirection?: string | null;
    stairLocation?: string | null;
    bedroomCount?: number | null;
    kitchenType?: string | null;
    groundLevelDifference?: number | null;
    netBuildableArea?: number | null;
  } = {},
): string {
  const typeLabel = BUILDING_TYPE_LABELS[buildingType] || buildingType;
  const floorsLabel = FLOORS_LABELS[floors] || floors;
  const floorsNum = FLOORS_COUNT[floors] || 1;
  const reqText = options.additionalRequirements
    ? `\n- متطلبات إضافية: ${options.additionalRequirements}`
    : "";

  const imageAnalysisSection = options.hasImages
    ? `\n\n**تحليل الصور المرفقة:**
قم أولاً بتحليل الصور المرفقة بعناية. حدد:
- الأبعاد المكانية والمقاسات المرئية
- العناصر الإنشائية (جدران، أعمدة، فتحات)
- الطراز المعماري والتصميمي
- أي ملاحظات أو قيود من الموقع أو التصميم المرجعي
ثم استخدم هذا التحليل لإثراء المخطط المعماري المولّد.`
    : "";

  const plotSection = `\n\n**أبعاد القطعة:**
- الجهة الشمالية: ${options.sideNorth ?? "—"} م
- الجهة الجنوبية: ${options.sideSouth ?? "—"} م
- الجهة الشرقية: ${options.sideEast ?? "—"} م
- الجهة الغربية: ${options.sideWest ?? "—"} م${options.chordLength ? `\n- قطر/وتر تصحيح الزاوية: ${options.chordLength} م` : ""}

**الاشتراطات والإيقاعات:**
- إيقاع أمامي (جهة الشارع): ${options.setbackFront ?? 0} م
- إيقاع جانبي (جهة الجيران - لكل جانب): ${options.setbackSide ?? 0} م
- إيقاع خلفي: ${options.setbackBack ?? 0} م${options.netBuildableArea != null ? `\n- **صافي المساحة القابلة للبناء للدور الواحد: ${options.netBuildableArea.toFixed(1)} م²**` : ""}`;

  const programSection = [
    options.bedroomCount ? `- عدد غرف النوم المطلوبة: ${options.bedroomCount}` : null,
    options.kitchenType ? `- نوع المطبخ: ${KITCHEN_TYPE_LABELS[options.kitchenType] || options.kitchenType}` : null,
    options.groundLevelDifference != null ? `- فارق منسوب الأرض عن الشارع: ${options.groundLevelDifference} سم` : null,
  ].filter(Boolean).join("\n");

  const programBlock = programSection
    ? `\n\n**البرنامج المساحي:**\n${programSection}`
    : "";

  const siteDetailsSection = [
    options.acType ? `- نظام التكييف: ${AC_TYPE_LABELS[options.acType] || options.acType} (لتحديد ارتفاعات الأسقف الإنشائية)` : null,
    options.facadeDirection ? `- اتجاه الواجهة الرئيسية: ${FACADE_DIRECTION_LABELS[options.facadeDirection] || options.facadeDirection}` : null,
    options.stairLocation ? `- موقع الدرج والمصعد: ${STAIR_LOCATION_LABELS[options.stairLocation] || options.stairLocation}` : null,
  ].filter(Boolean).join("\n");

  const siteDetailsBlock = siteDetailsSection
    ? `\n\n**تفاصيل الموقع والتصميم:**\n${siteDetailsSection}`
    : "";

  const engineeringRules = `

**قواعد هندسية إلزامية يجب تطبيقها في المخطط:**

1. **استيعاب الزوايا غير المنتظمة في غرف الخدمات:**
   إذا كانت القطعة تحتوي على زوايا غير قائمة أو زوايا مائلة (chord)، فيجب استيعاب هذه الأجزاء في غرف الخدمة (دورات مياه، مخازن، مصليات، مواقد غاز) وليس في غرف المعيشة الرئيسية.

2. **نسبة مساحة الممرات < 10%:**
   مجموع مساحة الممرات والردهات في كل دور يجب ألا يتجاوز 10% من مساحة ذلك الدور. إذا تجاوزت النسبة هذا الحد، يجب إعادة توزيع المساحات أو دمج الممرات مع فراغات أخرى.

3. **فصل مسار الضيوف عن مسار السكان من نقطة الدخول:**
   منذ لحظة الدخول، يجب أن يكون هناك مسار واضح ومستقل للضيوف (يتجه مباشرة نحو مجلس الرجال/الاستقبال) ومسار منفصل للسكان (يتجه نحو الصالة الداخلية وغرف النوم). لا يجب أن يتقاطع المساران في الفراغات الخاصة.

4. **توجيه غرف المعيشة الرئيسية نحو الشمال أو الشرق:**
   غرف المعيشة الرئيسية (صالة، غرف نوم رئيسية، مطبخ) يجب أن تواجه الجهة الشمالية أو الشرقية لضمان إضاءة طبيعية مناسبة طوال اليوم وتجنب أشعة الشمس المباشرة في أوقات الذروة الحرارية.

5. **اشتقاق شبكة الأعمدة من موقع الدرج/المصعد:**
   موقع الدرج والمصعد (المحدد في طلب المستخدم) هو المرجع الأساسي لتحديد شبكة الأعمدة الإنشائية. يجب أن تكون الأعمدة متوافقة مع محاور الدرج/المصعد وأن تُذكر الأبعاد التقريبية للشبكة (مثال: شبكة 5م × 5م).`;

  const strictIdentityBlock = `# هويتك ودورك
أنت **المصمم المعماري الخبير** — متخصص حصرياً في الاستشارات الهندسية والتخطيط المعماري.

## قواعد صارمة يجب اتباعها دائماً:

1. **رفض أي سؤال خارج نطاق تخصصك:**
   إذا طرح المستخدم أي سؤال لا يتعلق بالهندسة المعمارية أو التصميم المعماري أو التخطيط العمراني أو البناء، يجب أن ترد حصرياً بالنص التالي دون أي إضافة:
   "عذراً، تخصصي هو الاستشارات الهندسية والتخطيط المعماري فقط. يرجى تزويدي بأبعاد الأرض للبدء."

2. **التحقق من اكتمال البيانات قبل توليد أي مخطط:**
   لا تقم بتوليد مخطط معماري إلا إذا توفرت جميع البيانات التالية:
   - أبعاد الأرض الأربعة (شمال، جنوب، شرق، غرب)
   - قطر/وتر تصحيح الزاوية (إن وُجد)
   - الارتدادات (أمامي، جانبي، خلفي)
   - عدد الأدوار
   إذا كانت أي من هذه البيانات ناقصة، اطلب من المستخدم تزويدك بها قبل المتابعة.

3. **الالتزام بالتخصص المعماري:**
   جميع إجاباتك يجب أن تكون في إطار الهندسة المعمارية والتصميم والتخطيط فقط.

---

`;

  return `${strictIdentityBlock}أنت مهندس معماري محترف ومتخصص في تصميم المخططات المعمارية وإعداد ملفات AutoCAD. المستخدم يريد مخططاً معمارياً مفصلاً للمشروع التالي:

**تفاصيل المشروع:**
- نوع المبنى: ${typeLabel}
- الصنف/التخصص: ${buildingSubtype}
- المساحة الإجمالية للقطعة: ${area} متر مربع
- عدد الأدوار: ${floorsLabel} (${floorsNum} أدوار)${reqText}${plotSection}${programBlock}${siteDetailsBlock}${imageAnalysisSection}
${engineeringRules}

**المطلوب منك:**
قم بتوليد مخطط معماري مفصل وشامل يتضمن الأقسام التالية:

1. **الملخص التنفيذي** - وصف موجز للمشروع وفكرته العامة والطراز المعماري المقترح

2. **توزيع الفراغات والغرف** - قائمة تفصيلية لكل غرفة/فراغ في كل دور مع **المساحة الصافية بالمتر المربع** (م²)

3. **التوزيع بالأدوار** - وصف تفصيلي لكل دور بمفرده:
   - ما يحتويه من فراغات مع مساحة كل فراغ بالمتر المربع
   - العلاقات الوظيفية بين الفراغات
   - المساحة الإجمالية للدور

4. **الاشتراطات والمتطلبات** - الحد الأدنى للغرف والخدمات المطلوبة حسب نوع المبنى

5. **المقترحات المعمارية** - اقتراحات لتحسين التصميم، الإضاءة الطبيعية، التهوية، الخصوصية

6. **الجداول المساحية** - جدول ملخص بجميع الفراغات ومساحاتها الصافية (م²) بصيغة جدول Markdown

7. **تطبيق القواعد الهندسية** - قسم يوضح كيف طُبّقت كل قاعدة من القواعد الهندسية الإلزامية الخمس في هذا المخطط تحديداً

8. **الأبعاد والإحداثيات الدقيقة (Precise Dimensions & Coordinates)**
   قدم جدولاً تفصيلياً يتضمن:
   | العنصر | نقطة البداية (X, Y) | نقطة النهاية (X, Y) | الطول (م) | العرض (م) | الملاحظات |
   قم بتحديد إحداثيات كل جدار وفتحة ونافذة وباب بدقة، مع اعتبار النقطة (0,0) في الزاوية السفلية اليسرى من المبنى. استخدم وحدة المتر.

9. **استراتيجية طبقات AutoCAD (CAD Layering Strategy)**
   قدم جدول طبقات مقترح للرسم:
   | اسم الطبقة (Layer Name) | اللون | نوع الخط | الوصف |
   مثال: WALLS, WALLS-INT, DOORS, WINDOWS, FURNITURE, DIMS, TEXT, STAIRS, PLUMBING, ELECTRICAL

10. **سكربت AutoLISP**
    اكتب سكربت AutoLISP نظيف وجاهز للنسخ واللصق مباشرة في سطر أوامر AutoCAD.
    السكربت يجب أن:
    - ينشئ الطبقات المحددة أعلاه بألوانها
    - يرسم الهندسة الأساسية (الجدران الخارجية والداخلية) باستخدام أوامر LINE و PLINE
    - يرسم فتحات الأبواب والنوافذ
    - يضيف نصوص أسماء الغرف
    - يستخدم الإحداثيات الدقيقة من القسم 8
    ضع السكربت داخل code block بصيغة \`\`\`lisp

أجب باللغة التي استخدمها المستخدم في طلبه. اجعل الإجابة منظمة ومفصلة ومفيدة عملياً.`;
}

const MAX_IMAGES = 5;
const MAX_IMAGE_SIZE = 20 * 1024 * 1024;

function validateImages(imageUrls: string[]): string | null {
  if (imageUrls.length > MAX_IMAGES) return `Maximum ${MAX_IMAGES} images allowed`;
  for (const url of imageUrls) {
    if (!url.startsWith("data:image/")) return "Each image must be a data:image/ URL";
    if (url.length > MAX_IMAGE_SIZE * 1.37) return "Image exceeds maximum size";
  }
  return null;
}

function buildImageContentParts(imageDataUrls: string[]): ContentPart[] {
  return imageDataUrls.map((url) => ({
    type: "image_url" as const,
    image_url: { url, detail: "high" as const },
  }));
}

router.get("/sessions", async (req, res) => {
  try {
    const sessions = await db
      .select()
      .from(architectureSessions)
      .orderBy(architectureSessions.createdAt);
    res.json(sessions);
  } catch (err) {
    req.log.error({ err }, "Failed to list architecture sessions");
    res.status(500).json({ error: "Failed to list sessions" });
  }
});

router.post("/sessions", async (req, res) => {
  let streamStarted = false;

  const parseResult = CreateArchitectureSessionBody.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: "Invalid request body", details: parseResult.error.issues });
    return;
  }
  const body = parseResult.data;

  try {
    const titleMap: Record<string, string> = {
      villa: "فيلا",
      townhouse: "تاون هاوس",
      apartment: "شقة",
      offices: "مكاتب",
      shop: "متجر",
      other: "مبنى",
    };
    const typeLabel = titleMap[body.buildingType] || body.buildingType;
    const conversationTitle = `مخطط ${typeLabel} - ${body.buildingSubtype} (${body.area}م²)`;

    const [conversation] = await db
      .insert(conversations)
      .values({ title: conversationTitle })
      .returning();

    const imageUrls = body.images ?? [];
    const hasImages = imageUrls.length > 0;

    if (hasImages) {
      const imgError = validateImages(imageUrls);
      if (imgError) {
        res.status(400).json({ error: imgError });
        return;
      }
    }

    const netBuildableArea = computeNetBuildableArea({
      sideNorth: body.sideNorth,
      sideSouth: body.sideSouth,
      sideEast: body.sideEast,
      sideWest: body.sideWest,
      chordLength: body.chordLength,
      setbackFront: body.setbackFront,
      setbackSide: body.setbackSide,
      setbackBack: body.setbackBack,
    });

    const systemPrompt = buildArchitecturePrompt(
      body.buildingType,
      body.buildingSubtype,
      body.area,
      body.floors,
      {
        additionalRequirements: body.additionalRequirements,
        hasImages,
        sideNorth: body.sideNorth,
        sideSouth: body.sideSouth,
        sideEast: body.sideEast,
        sideWest: body.sideWest,
        chordLength: body.chordLength,
        setbackFront: body.setbackFront,
        setbackSide: body.setbackSide,
        setbackBack: body.setbackBack,
        acType: body.acType,
        facadeDirection: body.facadeDirection,
        stairLocation: body.stairLocation,
        bedroomCount: body.bedroomCount,
        kitchenType: body.kitchenType,
        groundLevelDifference: body.groundLevelDifference,
        netBuildableArea,
      },
    );

    await db.insert(messages).values({
      conversationId: conversation.id,
      role: "system",
      content: systemPrompt,
    });

    const facadeLabel = body.facadeDirection ? (FACADE_DIRECTION_LABELS[body.facadeDirection] || body.facadeDirection) : null;
    const acLabel = body.acType ? (AC_TYPE_LABELS[body.acType] || body.acType) : null;
    const stairLabel = body.stairLocation ? (STAIR_LOCATION_LABELS[body.stairLocation] || body.stairLocation) : null;
    const floorsLabel = FLOORS_LABELS[body.floors] || body.floors;

    const userRequestText = `أريد تصميم ${body.buildingSubtype} (${BUILDING_TYPE_LABELS[body.buildingType] || body.buildingType}) بمساحة ${body.area} م² وعدد أدوار: ${floorsLabel}. عدد غرف النوم: ${body.bedroomCount}. نوع المطبخ: ${KITCHEN_TYPE_LABELS[body.kitchenType] || body.kitchenType}. فارق المنسوب: ${body.groundLevelDifference} سم.${facadeLabel ? ` اتجاه الواجهة: ${facadeLabel}.` : ""}${acLabel ? ` نظام التكييف: ${acLabel}.` : ""}${stairLabel ? ` موقع الدرج: ${stairLabel}.` : ""}${body.additionalRequirements ? ` متطلبات إضافية: ${body.additionalRequirements}` : ""}${hasImages ? " أرفقت صوراً مرجعية للتحليل." : ""}`;

    const userContent: ContentPart[] = [
      { type: "text", text: userRequestText },
    ];
    if (hasImages) {
      userContent.push(...buildImageContentParts(imageUrls));
    }

    await db.insert(messages).values({
      conversationId: conversation.id,
      role: "user",
      content: userRequestText,
    });

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    streamStarted = true;

    let fullPlan = "";

    const stream = await openai.chat.completions.create({
      model: "gpt-5.2",
      max_completion_tokens: 16384,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
      stream: true,
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        fullPlan += content;
        res.write(`data: ${JSON.stringify({ content })}\n\n`);
      }
    }

    await db.insert(messages).values({
      conversationId: conversation.id,
      role: "assistant",
      content: fullPlan,
    });

    const [session] = await db
      .insert(architectureSessions)
      .values({
        buildingType: body.buildingType,
        buildingSubtype: body.buildingSubtype,
        area: body.area,
        floors: body.floors,
        sideNorth: body.sideNorth,
        sideSouth: body.sideSouth,
        sideEast: body.sideEast,
        sideWest: body.sideWest,
        chordLength: body.chordLength,
        setbackFront: body.setbackFront,
        setbackSide: body.setbackSide,
        setbackBack: body.setbackBack,
        acType: body.acType,
        facadeDirection: body.facadeDirection,
        stairLocation: body.stairLocation,
        bedroomCount: body.bedroomCount,
        kitchenType: body.kitchenType,
        groundLevelDifference: body.groundLevelDifference,
        additionalRequirements: body.additionalRequirements ?? null,
        generatedPlan: fullPlan,
        conversationId: conversation.id,
      })
      .returning();

    res.write(`data: ${JSON.stringify({ done: true, sessionId: session.id })}\n\n`);

    generateSessionImages(session.id, {
      area: body.area,
      buildingSubtype: body.buildingSubtype,
      buildingType: body.buildingType,
      facadeDirection: body.facadeDirection,
      sideNorth: body.sideNorth,
      sideSouth: body.sideSouth,
      sideEast: body.sideEast,
      sideWest: body.sideWest,
    }, fullPlan).catch((err) => {
      console.error("Background image generation failed:", err);
    });

    res.end();
  } catch (err) {
    req.log.error({ err }, "Failed to create architecture session");
    if (streamStarted) {
      res.write(`data: ${JSON.stringify({ done: true, error: "Failed to generate architecture plan" })}\n\n`);
      res.end();
    } else {
      res.status(500).json({ error: "Failed to generate architecture plan" });
    }
  }
});

router.get("/sessions/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [session] = await db
      .select()
      .from(architectureSessions)
      .where(eq(architectureSessions.id, id));
    if (!session) {
      res.status(404).json({ error: "Session not found" });
      return;
    }
    res.json(session);
  } catch (err) {
    req.log.error({ err }, "Failed to get architecture session");
    res.status(500).json({ error: "Failed to get session" });
  }
});

router.delete("/sessions/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);

    const [session] = await db
      .select()
      .from(architectureSessions)
      .where(eq(architectureSessions.id, id));

    if (!session) {
      res.status(404).json({ error: "Session not found" });
      return;
    }

    await db
      .delete(architectureSessions)
      .where(eq(architectureSessions.id, id));

    await db
      .delete(conversations)
      .where(eq(conversations.id, session.conversationId));

    res.status(204).end();
  } catch (err) {
    req.log.error({ err }, "Failed to delete architecture session");
    res.status(500).json({ error: "Failed to delete session" });
  }
});

interface CoordinateRow {
  element: string;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  length: number;
  width: number;
  notes: string;
}

function parseCoordinatesTable(planText: string): CoordinateRow[] {
  const rows: CoordinateRow[] = [];
  const lines = planText.split("\n");

  let inSection8 = false;
  let headerFound = false;

  for (const line of lines) {
    const trimmed = line.trim();

    if (/#{1,3}\s.*(?:8|٨).*(?:إحداثيات|Coordinates|أبعاد)/i.test(trimmed)) {
      inSection8 = true;
      headerFound = false;
      continue;
    }

    if (inSection8 && /#{1,3}\s.*(?:9|٩|10|١٠)/.test(trimmed)) {
      break;
    }

    if (!inSection8) continue;

    if (trimmed.startsWith("|") && (trimmed.includes("---") || trimmed.includes(":-"))) {
      headerFound = true;
      continue;
    }

    if (trimmed.startsWith("|") && trimmed.includes("العنصر")) {
      headerFound = false;
      continue;
    }

    if (!headerFound) continue;

    if (trimmed.startsWith("|")) {
      const cells = trimmed
        .split("|")
        .map((c) => c.trim())
        .filter((c) => c.length > 0);

      if (cells.length >= 5) {
        const parseCoord = (s: string): [number, number] => {
          const nums = s.replace(/[()（）]/g, "").split(/[,،\s]+/).map(Number);
          return [nums[0] || 0, nums[1] || 0];
        };

        const [sx, sy] = parseCoord(cells[1] || "0,0");
        const [ex, ey] = parseCoord(cells[2] || "0,0");
        const len = parseFloat(cells[3]) || 0;
        const w = parseFloat(cells[4]) || 0;

        rows.push({
          element: cells[0],
          startX: sx,
          startY: sy,
          endX: ex,
          endY: ey,
          length: len,
          width: w,
          notes: cells[5] || "",
        });
      }
    }
  }

  return rows;
}

function getLayerForElement(element: string): string {
  const lower = element.toLowerCase();
  const arabic = element;
  if (lower.includes("door") || arabic.includes("باب")) return "DOORS";
  if (lower.includes("window") || arabic.includes("نافذة") || arabic.includes("شباك")) return "WINDOWS";
  if (lower.includes("stair") || arabic.includes("درج") || arabic.includes("سلم")) return "STAIRS";
  return "WALLS";
}

function generateDxf(rows: CoordinateRow[]): string {
  const d = new Drawing();
  d.setUnits("Meters");

  d.addLayer("WALLS", Drawing.ACI.WHITE, "CONTINUOUS");
  d.addLayer("WALLS-INT", Drawing.ACI.YELLOW, "CONTINUOUS");
  d.addLayer("DOORS", Drawing.ACI.RED, "CONTINUOUS");
  d.addLayer("WINDOWS", Drawing.ACI.CYAN, "CONTINUOUS");
  d.addLayer("STAIRS", Drawing.ACI.GREEN, "CONTINUOUS");
  d.addLayer("TEXT", Drawing.ACI.WHITE, "CONTINUOUS");

  for (const row of rows) {
    const layer = getLayerForElement(row.element);
    d.setActiveLayer(layer);

    if (row.startX === row.endX && row.startY === row.endY && row.length === 0) {
      continue;
    }

    d.drawLine(row.startX, row.startY, row.endX, row.endY);

    if (row.width > 0) {
      const dx = row.endX - row.startX;
      const dy = row.endY - row.startY;
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len > 0) {
        const nx = -dy / len * row.width;
        const ny = dx / len * row.width;
        d.drawLine(row.startX + nx, row.startY + ny, row.endX + nx, row.endY + ny);
        d.drawLine(row.startX, row.startY, row.startX + nx, row.startY + ny);
        d.drawLine(row.endX, row.endY, row.endX + nx, row.endY + ny);
      }
    }
  }

  d.setActiveLayer("TEXT");
  const labeled = new Set<string>();
  for (const row of rows) {
    if (!labeled.has(row.element)) {
      const cx = (row.startX + row.endX) / 2;
      const cy = (row.startY + row.endY) / 2;
      d.drawText(cx, cy - 0.3, 0.25, 0, row.element);
      labeled.add(row.element);
    }
  }

  return d.toDxfString();
}

function extractRoomSummary(planText: string): string {
  const roomPatterns = /(?:غرف?\s*(?:نوم|معيشة|جلوس)|صالة|مطبخ|حمام|مجلس|مدخل|درج|مصعد|كراج|مخزن)/g;
  const matches = planText.match(roomPatterns);
  if (matches && matches.length > 0) {
    const unique = [...new Set(matches)].slice(0, 8);
    return unique.join(", ");
  }
  return "";
}

async function generateSessionImages(
  sessionId: number,
  session: {
    area: number;
    buildingSubtype: string;
    buildingType: string;
    facadeDirection: string;
    sideNorth: number;
    sideSouth: number;
    sideEast: number;
    sideWest: number;
  },
  planText: string,
) {
  const facadeLabel = FACADE_DIRECTION_LABELS[session.facadeDirection] || session.facadeDirection;
  const typeLabel = BUILDING_TYPE_LABELS[session.buildingType] || session.buildingType;

  const avgWidth = ((session.sideNorth || 0) + (session.sideSouth || 0)) / 2;
  const avgDepth = ((session.sideEast || 0) + (session.sideWest || 0)) / 2;

  const coordinates = parseCoordinatesTable(planText);
  const wallCount = coordinates.filter(r => getLayerForElement(r.element) === "WALLS").length;
  const doorCount = coordinates.filter(r => getLayerForElement(r.element) === "DOORS").length;
  const windowCount = coordinates.filter(r => getLayerForElement(r.element) === "WINDOWS").length;
  const roomSummary = extractRoomSummary(planText);

  const coordsDetail = coordinates.length > 0
    ? ` The plan has ${wallCount} wall segments, ${doorCount} doors, and ${windowCount} windows.`
    : "";
  const roomDetail = roomSummary ? ` Rooms include: ${roomSummary}.` : "";

  try {
    const [floorPlanResult, exteriorResult] = await Promise.allSettled([
      openai.images.generate({
        model: "dall-e-3",
        prompt: `Professional 2D architectural floor plan, top-down view, clean blueprint style with white lines on dark blue background. Building type: ${typeLabel} - ${session.buildingSubtype}. Plot dimensions: ${avgWidth.toFixed(1)}m x ${avgDepth.toFixed(1)}m, total area ${session.area}m².${coordsDetail}${roomDetail} Show room layouts, walls, doors, windows, and room labels. Minimalist technical drawing style.`,
        n: 1,
        size: "1024x1024",
        quality: "standard",
      }),
      openai.images.generate({
        model: "dall-e-3",
        prompt: `Professional 3D exterior architectural rendering of a modern ${typeLabel} - ${session.buildingSubtype}. Facade facing ${facadeLabel}. Building footprint ${avgWidth.toFixed(1)}m x ${avgDepth.toFixed(1)}m.${doorCount > 0 ? ` Main entrance with ${doorCount} door openings visible.` : ""}${windowCount > 0 ? ` ${windowCount} windows on the facade.` : ""} Contemporary Middle Eastern architectural style with clean geometric forms, natural stone and white plaster finish. Landscape with desert-adapted plants. Golden hour lighting. Photorealistic rendering.`,
        n: 1,
        size: "1024x1024",
        quality: "standard",
      }),
    ]);

    const floorPlanUrl = floorPlanResult.status === "fulfilled" ? floorPlanResult.value.data[0]?.url ?? null : null;
    const exteriorUrl = exteriorResult.status === "fulfilled" ? exteriorResult.value.data[0]?.url ?? null : null;

    if (floorPlanUrl || exteriorUrl) {
      await db
        .update(architectureSessions)
        .set({
          floorPlanImageUrl: floorPlanUrl,
          exteriorImageUrl: exteriorUrl,
        })
        .where(eq(architectureSessions.id, sessionId));
    }

    return { floorPlanUrl, exteriorUrl };
  } catch (err) {
    console.error("Image generation error:", err);
    return { floorPlanUrl: null, exteriorUrl: null };
  }
}

router.get("/sessions/:id/dxf", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [session] = await db
      .select()
      .from(architectureSessions)
      .where(eq(architectureSessions.id, id));

    if (!session) {
      res.status(404).json({ error: "Session not found" });
      return;
    }

    const rows = parseCoordinatesTable(session.generatedPlan);

    if (rows.length === 0) {
      const d = new Drawing();
      d.setUnits("Meters");
      d.addLayer("WALLS", Drawing.ACI.WHITE, "CONTINUOUS");
      d.setActiveLayer("WALLS");

      const w = ((session.sideNorth || 0) + (session.sideSouth || 0)) / 2 || 20;
      const h = ((session.sideEast || 0) + (session.sideWest || 0)) / 2 || 15;

      d.drawLine(0, 0, w, 0);
      d.drawLine(w, 0, w, h);
      d.drawLine(w, h, 0, h);
      d.drawLine(0, h, 0, 0);

      d.drawText(w / 2, h / 2, 0.5, 0, session.buildingSubtype || "Building");

      const dxfContent = d.toDxfString();
      res.setHeader("Content-Type", "application/dxf");
      res.setHeader("Content-Disposition", `attachment; filename="plan-${id}.dxf"`);
      res.send(dxfContent);
      return;
    }

    const dxfContent = generateDxf(rows);
    res.setHeader("Content-Type", "application/dxf");
    res.setHeader("Content-Disposition", `attachment; filename="plan-${id}.dxf"`);
    res.send(dxfContent);
  } catch (err) {
    req.log.error({ err }, "Failed to generate DXF");
    res.status(500).json({ error: "Failed to generate DXF file" });
  }
});

router.post("/sessions/:id/followup", async (req, res) => {
  let streamStarted = false;

  const parseResult = SendArchitectureFollowupBody.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: "Invalid request body", details: parseResult.error.issues });
    return;
  }
  const body = parseResult.data;

  try {
    const id = parseInt(req.params.id);

    const [session] = await db
      .select()
      .from(architectureSessions)
      .where(eq(architectureSessions.id, id));
    if (!session) {
      res.status(404).json({ error: "Session not found" });
      return;
    }

    const imageUrls = body.images ?? [];
    if (imageUrls.length > 0) {
      const imgError = validateImages(imageUrls);
      if (imgError) {
        res.status(400).json({ error: imgError });
        return;
      }
    }

    const history = await db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, session.conversationId))
      .orderBy(messages.createdAt);

    await db.insert(messages).values({
      conversationId: session.conversationId,
      role: "user",
      content: body.question,
    });

    const chatMessages = history.map((m) => ({
      role: m.role as "system" | "user" | "assistant",
      content: m.content,
    }));

    chatMessages.push({
      role: "system",
      content: `تذكير: أنت **المصمم المعماري الخبير**. تخصصك الوحيد هو الاستشارات الهندسية والتخطيط المعماري. إذا طرح المستخدم أي سؤال خارج هذا النطاق، أجب حصرياً بـ: "عذراً، تخصصي هو الاستشارات الهندسية والتخطيط المعماري فقط. يرجى تزويدي بأبعاد الأرض للبدء." لا تخرج عن هذا التخصص تحت أي ظرف.`,
    });

    if (imageUrls.length > 0) {
      const userContent: ContentPart[] = [
        { type: "text", text: body.question },
        ...buildImageContentParts(imageUrls),
      ];
      chatMessages.push({ role: "user", content: userContent as unknown as string });
    } else {
      chatMessages.push({ role: "user", content: body.question });
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    streamStarted = true;

    let fullResponse = "";

    const stream = await openai.chat.completions.create({
      model: "gpt-5.2",
      max_completion_tokens: 16384,
      messages: chatMessages,
      stream: true,
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        fullResponse += content;
        res.write(`data: ${JSON.stringify({ content })}\n\n`);
      }
    }

    await db.insert(messages).values({
      conversationId: session.conversationId,
      role: "assistant",
      content: fullResponse,
    });

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (err) {
    req.log.error({ err }, "Failed to send followup");
    if (streamStarted) {
      res.write(`data: ${JSON.stringify({ done: true, error: "Failed to generate response" })}\n\n`);
      res.end();
    } else {
      res.status(500).json({ error: "Failed to send followup" });
    }
  }
});

export default router;
