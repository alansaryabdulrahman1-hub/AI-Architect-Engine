import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { conversations, messages, architectureSessions } from "@workspace/db";
import { openai } from "@workspace/integrations-openai-ai-server";
import {
  CreateArchitectureSessionBody,
  SendArchitectureFollowupBody,
} from "@workspace/api-zod";
import { eq } from "drizzle-orm";

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
): string {
  const typeLabel = BUILDING_TYPE_LABELS[buildingType] || buildingType;
  const reqText = additionalRequirements
    ? `\n- متطلبات إضافية: ${additionalRequirements}`
    : "";

  return `أنت مهندس معماري محترف ومتخصص في تصميم المخططات المعمارية. المستخدم يريد مخططاً معمارياً مفصلاً للمشروع التالي:

**تفاصيل المشروع:**
- نوع المبنى: ${typeLabel}
- الصنف/التخصص: ${buildingSubtype}
- المساحة الإجمالية: ${area} متر مربع
- عدد الأدوار: ${floors} دور${reqText}

**المطلوب منك:**
قم بتوليد مخطط معماري مفصل وشامل يتضمن:

1. **الملخص التنفيذي** - وصف موجز للمشروع وفكرته العامة

2. **توزيع الفراغات والغرف** - قائمة تفصيلية لكل غرفة/فراغ في كل دور مع المساحة التقريبية المقترحة بالمتر المربع

3. **التوزيع بالأدوار** - وصف تفصيلي لكل دور بمفرده:
   - ما يحتويه من فراغات
   - العلاقات الوظيفية بين الفراغات
   - المساحة الإجمالية للدور

4. **الاشتراطات والمتطلبات** - الحد الأدنى للغرف والخدمات المطلوبة حسب نوع المبنى

5. **المقترحات المعمارية** - اقتراحات لتحسين التصميم، الإضاءة الطبيعية، التهوية، الخصوصية

6. **الجداول المساحية** - جدول ملخص بجميع الفراغات ومساحاتها

7. **ملاحظات إضافية** - أي توصيات أو اعتبارات خاصة بهذا النوع من المباني

أجب باللغة التي استخدمها المستخدم في طلبه. اجعل الإجابة منظمة ومفصلة ومفيدة عملياً.`;
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
  try {
    const body = CreateArchitectureSessionBody.parse(req.body);

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

    const systemMessage = buildArchitecturePrompt(
      body.buildingType,
      body.buildingSubtype,
      body.area,
      body.floors,
      body.additionalRequirements,
    );

    await db.insert(messages).values({
      conversationId: conversation.id,
      role: "user",
      content: systemMessage,
    });

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    let fullPlan = "";

    const stream = await openai.chat.completions.create({
      model: "gpt-5.2",
      max_completion_tokens: 8192,
      messages: [{ role: "user", content: systemMessage }],
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
    res.write(`data: ${JSON.stringify({ error: "Failed to generate architecture plan" })}\n\n`);
    res.end();
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
    const [deleted] = await db
      .delete(architectureSessions)
      .where(eq(architectureSessions.id, id))
      .returning();
    if (!deleted) {
      res.status(404).json({ error: "Session not found" });
      return;
    }
    res.status(204).end();
  } catch (err) {
    req.log.error({ err }, "Failed to delete architecture session");
    res.status(500).json({ error: "Failed to delete session" });
  }
});

router.post("/sessions/:id/followup", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const body = SendArchitectureFollowupBody.parse(req.body);

    const [session] = await db
      .select()
      .from(architectureSessions)
      .where(eq(architectureSessions.id, id));
    if (!session) {
      res.status(404).json({ error: "Session not found" });
      return;
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

    const chatMessages = [
      ...history.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
      { role: "user" as const, content: body.question },
    ];

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    let fullResponse = "";

    const stream = await openai.chat.completions.create({
      model: "gpt-5.2",
      max_completion_tokens: 8192,
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
    req.log.error({ err }, "Failed to process followup question");
    res.write(`data: ${JSON.stringify({ error: "Failed to process question" })}\n\n`);
    res.end();
  }
});

export default router;
