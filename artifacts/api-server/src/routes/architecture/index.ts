import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { conversations, messages, architectureSessions } from "@workspace/db";
import { openai } from "@workspace/integrations-openai-ai-server";
import {
  CreateArchitectureSessionBody,
  SendArchitectureFollowupBody,
} from "@workspace/api-zod";
import { eq } from "drizzle-orm";
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

function buildArchitecturePrompt(
  buildingType: string,
  buildingSubtype: string,
  area: number,
  floors: number,
  additionalRequirements?: string | null,
  hasImages?: boolean,
): string {
  const typeLabel = BUILDING_TYPE_LABELS[buildingType] || buildingType;
  const reqText = additionalRequirements
    ? `\n- متطلبات إضافية: ${additionalRequirements}`
    : "";

  const imageAnalysisSection = hasImages
    ? `\n\n**تحليل الصور المرفقة:**
قم أولاً بتحليل الصور المرفقة بعناية. حدد:
- الأبعاد المكانية والمقاسات المرئية
- العناصر الإنشائية (جدران، أعمدة، فتحات)
- الطراز المعماري والتصميمي
- أي ملاحظات أو قيود من الموقع أو التصميم المرجعي
ثم استخدم هذا التحليل لإثراء المخطط المعماري المولّد.`
    : "";

  return `أنت مهندس معماري محترف ومتخصص في تصميم المخططات المعمارية وإعداد ملفات AutoCAD. المستخدم يريد مخططاً معمارياً مفصلاً للمشروع التالي:

**تفاصيل المشروع:**
- نوع المبنى: ${typeLabel}
- الصنف/التخصص: ${buildingSubtype}
- المساحة الإجمالية: ${area} متر مربع
- عدد الأدوار: ${floors} دور${reqText}${imageAnalysisSection}

**المطلوب منك:**
قم بتوليد مخطط معماري مفصل وشامل يتضمن الأقسام التالية:

1. **الملخص التنفيذي** - وصف موجز للمشروع وفكرته العامة والطراز المعماري المقترح

2. **توزيع الفراغات والغرف** - قائمة تفصيلية لكل غرفة/فراغ في كل دور مع المساحة التقريبية المقترحة بالمتر المربع

3. **التوزيع بالأدوار** - وصف تفصيلي لكل دور بمفرده:
   - ما يحتويه من فراغات
   - العلاقات الوظيفية بين الفراغات
   - المساحة الإجمالية للدور

4. **الاشتراطات والمتطلبات** - الحد الأدنى للغرف والخدمات المطلوبة حسب نوع المبنى

5. **المقترحات المعمارية** - اقتراحات لتحسين التصميم، الإضاءة الطبيعية، التهوية، الخصوصية

6. **الجداول المساحية** - جدول ملخص بجميع الفراغات ومساحاتها (بصيغة جدول Markdown)

7. **ملاحظات إضافية** - أي توصيات أو اعتبارات خاصة بهذا النوع من المباني

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

    const systemPrompt = buildArchitecturePrompt(
      body.buildingType,
      body.buildingSubtype,
      body.area,
      body.floors,
      body.additionalRequirements,
      hasImages,
    );

    await db.insert(messages).values({
      conversationId: conversation.id,
      role: "system",
      content: systemPrompt,
    });

    const userRequestText = `أريد تصميم ${body.buildingSubtype} (${BUILDING_TYPE_LABELS[body.buildingType] || body.buildingType}) بمساحة ${body.area} م² وعدد ${body.floors} أدوار.${body.additionalRequirements ? ` متطلبات إضافية: ${body.additionalRequirements}` : ""}${hasImages ? " أرفقت صوراً مرجعية للتحليل." : ""}`;

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
        additionalRequirements: body.additionalRequirements ?? null,
        generatedPlan: fullPlan,
        conversationId: conversation.id,
      })
      .returning();

    res.write(`data: ${JSON.stringify({ done: true, sessionId: session.id })}\n\n`);
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
      messages: chatMessages as Parameters<typeof openai.chat.completions.create>[0]["messages"],
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
    req.log.error({ err }, "Failed to process followup question");
    if (streamStarted) {
      res.write(`data: ${JSON.stringify({ done: true, error: "Failed to process question" })}\n\n`);
      res.end();
    } else {
      res.status(500).json({ error: "Failed to process question" });
    }
  }
});

export default router;
